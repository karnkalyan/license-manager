import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { AuditSeverity, LicenseStatus, ClientState } from "../generated/prisma/enums.js";
import {
  extendLicenseDate,
  reissueCurrentLicense,
  findActiveLicenseForInstallation,
} from "../services/licenseService.js";
import { provisioningRegistry } from "../tcp/registry.js";
import { pushLicenseEvent, deliverProvisionedLicense } from "../tcp/server.js";
import { registry } from "../tcp/registry.js";
import { audit } from "../services/audit.js";

export const apiV1Router = Router();

// Extend Request type for apiKey
declare global {
  namespace Express {
    interface Request {
      apiKey?: {
        id: string;
        key: string;
        name: string;
        allowedDomains: string;
        role: string;
        dealerId: string | null;
        expiresAt: Date;
      };
    }
  }
}

// Domain matching helper
function isDomainAllowed(requestHost: string, allowedDomainsString: string): boolean {
  if (allowedDomainsString === "*" || allowedDomainsString.trim() === "") return true;

  const firstPart = requestHost.toLowerCase().split(":")[0] ?? "";
  const cleanHost = firstPart.trim();
  const allowed = allowedDomainsString
    .split(",")
    .map((d) => (d.trim().toLowerCase().split(":")[0] ?? ""))
    .filter((d): d is string => Boolean(d));

  for (const domain of allowed) {
    if (domain === "*" || domain === cleanHost) return true;
    if (domain.startsWith("*.")) {
      const suffix = domain.slice(2);
      if (cleanHost === suffix || cleanHost.endsWith(`.${suffix}`)) return true;
    }
  }
  return false;
}

// API Key authentication and domain authorization middleware
export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const rawHeader = req.headers["x-api-key"] || req.headers.authorization;
    let token: string | undefined;

    if (typeof rawHeader === "string") {
      if (rawHeader.startsWith("Bearer ")) {
        token = rawHeader.slice(7).trim();
      } else {
        token = rawHeader.trim();
      }
    } else if (typeof req.query.api_key === "string") {
      token = req.query.api_key.trim();
    }

    if (!token) {
      return res.status(401).json({
        error: "API key required. Provide 'X-API-Key' or 'Authorization: Bearer KTX_...' header.",
      });
    }

    const apiKey = await prisma.apiKey.findUnique({
      where: { key: token },
    });

    if (!apiKey || !apiKey.isActive) {
      return res.status(401).json({ error: "Invalid or inactive API key" });
    }

    if (apiKey.expiresAt.getTime() <= Date.now()) {
      return res.status(401).json({
        error: `API key expired on ${apiKey.expiresAt.toISOString()}. Please request or generate a new API key.`,
      });
    }

    // Domain / Origin Verification
    let incomingHost = "";
    if (req.headers.origin) {
      try {
        incomingHost = new URL(req.headers.origin).hostname;
      } catch {
        incomingHost = String(req.headers.origin);
      }
    } else if (req.headers.referer) {
      try {
        incomingHost = new URL(req.headers.referer).hostname;
      } catch {
        incomingHost = String(req.headers.referer);
      }
    } else if (req.headers["x-forwarded-host"]) {
      incomingHost = String(req.headers["x-forwarded-host"]);
    } else {
      incomingHost = req.hostname || "localhost";
    }

    if (!isDomainAllowed(incomingHost, apiKey.allowedDomains)) {
      return res.status(403).json({
        error: `Domain not authorized. Incoming '${incomingHost}' is not allowed for this key. Authorized: [${apiKey.allowedDomains}]`,
      });
    }

    // Update lastUsedAt asynchronously
    void prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    req.apiKey = apiKey;
    next();
  } catch (err) {
    console.error("API Key auth error:", err);
    return res.status(500).json({ error: "API key validation error" });
  }
}

// Apply API Key auth to all v1 endpoints
apiV1Router.use(requireApiKey);

// GET /api/v1/status - Check key info and validity
apiV1Router.get("/status", (req, res) => {
  const k = req.apiKey!;
  res.json({
    ok: true,
    keyName: k.name,
    role: k.role,
    allowedDomains: k.allowedDomains,
    expiresAt: k.expiresAt.toISOString(),
    remainingDays: Math.max(0, Math.ceil((k.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))),
  });
});

// GET /api/v1/licenses - Review complete license information
apiV1Router.get("/licenses", async (req, res) => {
  const apiKey = req.apiKey!;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const statusParam = typeof req.query.status === "string" ? req.query.status.trim().toUpperCase() : undefined;
  const appParam = typeof req.query.application === "string" ? req.query.application.trim() : undefined;

  const licenses = await prisma.license.findMany({
    where: {
      ...(apiKey.dealerId ? { dealerId: apiKey.dealerId } : {}),
      ...(statusParam && ["ACTIVE", "SUSPENDED", "REVOKED", "EXPIRED"].includes(statusParam)
        ? { status: statusParam as any }
        : {}),
      ...(appParam
        ? {
            OR: [
              { product: { code: appParam } },
              { product: { publicId: appParam } },
              { product: { name: { contains: appParam } } },
            ],
          }
        : {}),
      ...(q
        ? {
            OR: [
              { serial: { contains: q } },
              { customerRef: { contains: q } },
              { customerTenant: { contains: q } },
              { product: { name: { contains: q } } },
              { product: { tenant: { name: { contains: q } } } },
            ],
          }
        : {}),
    },
    include: {
      product: {
        include: {
          tenant: { select: { id: true, name: true, code: true, publicId: true, status: true } },
        },
      },
      dealer: {
        select: { id: true, username: true, dealerName: true, dealerPhone: true, dealerEmail: true },
      },
      modules: {
        include: {
          module: { select: { id: true, code: true, name: true, description: true } },
        },
      },
      activations: {
        select: {
          id: true,
          clientId: true,
          state: true,
          platform: true,
          appVersion: true,
          lastHeartbeatAt: true,
          connectedAt: true,
          lastIp: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const now = Date.now();
  const formatted = licenses.map((l) => {
    const isExpired = l.expiresAt ? l.expiresAt.getTime() <= now : false;
    const meta = (l.metadata && typeof l.metadata === "object" ? l.metadata : {}) as Record<string, any>;

    return {
      serial: l.serial,
      status: isExpired && l.status === "ACTIVE" ? "EXPIRED" : l.status,
      customerOrganization: l.customerTenant || l.customerRef || "Standard Client",
      customerContact: {
        name: meta.customerName || l.customerRef || null,
        email: meta.customerEmail || null,
      },
      vendor: {
        id: l.product.tenant.id,
        name: l.product.tenant.name,
        code: l.product.tenant.code,
        publicId: l.product.tenant.publicId,
        status: l.product.tenant.status,
      },
      application: {
        id: l.product.id,
        name: l.product.name,
        code: l.product.code,
        publicId: l.product.publicId,
      },
      dealer: l.dealer
        ? {
            id: l.dealer.id,
            username: l.dealer.username,
            name: l.dealer.dealerName || l.dealer.username,
            phone: l.dealer.dealerPhone,
            email: l.dealer.dealerEmail,
          }
        : null,
      seats: {
        maxActivations: l.maxActivations,
        activeActivations: l.activations.length,
      },
      dates: {
        validFrom: l.validFrom.toISOString(),
        expiresAt: l.expiresAt ? l.expiresAt.toISOString() : null,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
        lastValidatedAt: l.lastValidatedAt ? l.lastValidatedAt.toISOString() : null,
      },
      modules: l.modules.map((m) => ({
        code: m.module.code,
        name: m.module.name,
        description: m.module.description,
      })),
      entitlements: meta.entitlements || {},
      activations: l.activations.map((a) => ({
        ...a,
        isSocketOnline: !!registry.get(a.clientId),
      })),
    };
  });

  res.json({
    total: formatted.length,
    licenses: formatted,
  });
});

// GET /api/v1/licenses/:serial - Inspect specific license
apiV1Router.get("/licenses/:serial", async (req, res) => {
  const serial = req.params.serial as string;
  const apiKey = req.apiKey!;

  const l = await prisma.license.findFirst({
    where: {
      serial,
      ...(apiKey.dealerId ? { dealerId: apiKey.dealerId } : {}),
    },
    include: {
      product: {
        include: {
          tenant: { select: { id: true, name: true, code: true, publicId: true, status: true } },
        },
      },
      dealer: {
        select: { id: true, username: true, dealerName: true, dealerPhone: true, dealerEmail: true },
      },
      modules: {
        include: {
          module: { select: { id: true, code: true, name: true, description: true } },
        },
      },
      activations: true,
    },
  });

  if (!l) {
    return res.status(404).json({ error: "License not found or access denied" });
  }

  const now = Date.now();
  const isExpired = l.expiresAt ? l.expiresAt.getTime() <= now : false;
  const meta = (l.metadata && typeof l.metadata === "object" ? l.metadata : {}) as Record<string, any>;

  res.json({
    serial: l.serial,
    status: isExpired && l.status === "ACTIVE" ? "EXPIRED" : l.status,
    customerOrganization: l.customerTenant || l.customerRef || "Standard Client",
    customerContact: {
      name: meta.customerName || l.customerRef || null,
      email: meta.customerEmail || null,
    },
    vendor: {
      name: l.product.tenant.name,
      code: l.product.tenant.code,
      publicId: l.product.tenant.publicId,
    },
    application: {
      name: l.product.name,
      code: l.product.code,
      publicId: l.product.publicId,
    },
    dealer: l.dealer
      ? {
          name: l.dealer.dealerName || l.dealer.username,
          username: l.dealer.username,
          phone: l.dealer.dealerPhone,
          email: l.dealer.dealerEmail,
        }
      : null,
    seats: {
      maxActivations: l.maxActivations,
      activeActivations: l.activations.length,
    },
    dates: {
      validFrom: l.validFrom.toISOString(),
      expiresAt: l.expiresAt ? l.expiresAt.toISOString() : null,
      createdAt: l.createdAt.toISOString(),
      lastExtendedAt: meta.lastExtendedAt || null,
    },
    modules: l.modules.map((m) => ({
      code: m.module.code,
      name: m.module.name,
    })),
    entitlements: meta.entitlements || {},
    activations: l.activations.map((a) => ({
      clientId: a.clientId,
      state: a.state,
      platform: a.platform,
      appVersion: a.appVersion,
      socketOnline: !!registry.get(a.clientId),
      lastHeartbeatAt: a.lastHeartbeatAt,
    })),
  });
});

// POST /api/v1/licenses/:serial/extend - Extend license expiration date via API
apiV1Router.post("/licenses/:serial/extend", async (req, res) => {
  const serial = req.params.serial as string;
  const apiKey = req.apiKey!;

  if (apiKey.role === "READ_ONLY") {
    return res.status(403).json({ error: "This API key only has READ_ONLY permissions. License extension not permitted." });
  }

  const schema = z.object({
    days: z.coerce.number().int().min(1).max(3650).optional(),
    expiresAt: z.coerce.date().optional(),
    customerRef: z.string().max(120).optional(),
    reason: z.string().max(300).optional(),
  }).refine((data) => data.days !== undefined || data.expiresAt !== undefined, {
    message: "Either 'days' (e.g. 30, 90, 365) or 'expiresAt' (ISO date) must be provided",
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid extension parameters", details: parsed.error.flatten() });
  }

  // Find target license
  const license = await prisma.license.findFirst({
    where: {
      serial,
      ...(apiKey.dealerId ? { dealerId: apiKey.dealerId } : {}),
    },
    include: {
      product: { include: { tenant: true } },
      activations: true,
    },
  });

  if (!license) {
    return res.status(404).json({ error: "License not found or access denied" });
  }

  // Calculate new expiration date
  let nextExpiresAt: Date;
  if (parsed.data.expiresAt) {
    nextExpiresAt = parsed.data.expiresAt;
  } else {
    const currentBase = license.expiresAt && license.expiresAt.getTime() > Date.now()
      ? license.expiresAt.getTime()
      : Date.now();
    nextExpiresAt = new Date(currentBase + parsed.data.days! * 24 * 60 * 60 * 1000);
  }

  if (nextExpiresAt.getTime() <= Date.now()) {
    return res.status(400).json({ error: "New expiration date must be in the future" });
  }

  try {
    const extended = await extendLicenseDate(license.id, nextExpiresAt, parsed.data.customerRef);

    // Push live update to connected clients
    await Promise.all(
      extended.activations.map(async (a) => {
        await pushLicenseEvent(
          a.clientId,
          "LICENSE_KEY_REISSUED",
          `License validity extended until ${nextExpiresAt.toLocaleDateString()}`,
        );
        deliverProvisionedLicense(
          {
            clientId: a.clientId,
            tenantId: extended.product.tenant.publicId,
            applicationId: extended.product.publicId,
            hwid: "",
          },
          extended.jwtKey,
        );
      }),
    );

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "LICENSE_EXTENDED_VIA_API",
        entityType: "License",
        entityId: license.id,
        details: {
          serial: license.serial,
          apiKeyName: apiKey.name,
          previousExpiry: license.expiresAt?.toISOString() ?? "Perpetual",
          newExpiry: nextExpiresAt.toISOString(),
          reason: parsed.data.reason || "Extended via authorized API Key",
        },
      },
    });

    res.json({
      ok: true,
      serial: extended.serial,
      status: extended.status,
      expiresAt: extended.expiresAt?.toISOString(),
      previousExpiresAt: license.expiresAt?.toISOString(),
      entitlementVersion: extended.entitlementVersion,
      jwtKey: extended.jwtKey,
      message: `License successfully extended until ${nextExpiresAt.toISOString()}`,
    });
  } catch (err) {
    console.error("License extension error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to extend license" });
  }
});


// POST /api/v1/licenses/:serial/status - Update license status (ACTIVE, SUSPENDED, REVOKED)
apiV1Router.post("/licenses/:serial/status", async (req, res) => {
  const serial = req.params.serial as string;
  const apiKey = req.apiKey!;

  if (apiKey.role === "READ_ONLY") {
    return res.status(403).json({ error: "This API key has READ_ONLY permissions. Status mutation not permitted." });
  }

  const parsed = z
    .object({
      status: z.enum(["ACTIVE", "SUSPENDED", "REVOKED"]),
      reason: z.string().max(500).optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid status. Must be ACTIVE, SUSPENDED, or REVOKED", details: parsed.error.flatten() });
  }

  const license = await prisma.license.findFirst({
    where: {
      serial,
      ...(apiKey.dealerId ? { dealerId: apiKey.dealerId } : {}),
    },
    include: {
      product: { include: { tenant: true } },
      activations: true,
      modules: { include: { module: true } },
    },
  });

  if (!license) {
    return res.status(404).json({ error: "License not found or access denied" });
  }

  const targetStatus = parsed.data.status as LicenseStatus;
  const reason = parsed.data.reason || (targetStatus === "REVOKED" ? "Revoked via API" : targetStatus === "ACTIVE" ? "Restored via API" : "Suspended via API");

  const updated = await prisma.license.update({
    where: { id: license.id },
    data: {
      status: targetStatus,
      revokedAt: targetStatus === "REVOKED" ? new Date() : null,
      revokeReason: targetStatus === "ACTIVE" ? null : reason,
    },
    include: {
      product: { include: { tenant: true } },
      activations: true,
      modules: { include: { module: true } },
    },
  });

  if (targetStatus === "ACTIVE") {
    await Promise.all(
      updated.activations.map(async (a) => {
        await pushLicenseEvent(a.clientId, "LICENSE_RESTORED", reason);
        await pushLicenseEvent(a.clientId, "REVALIDATE_NOW", reason);
      })
    );

    const waitingActivations = updated.activations.filter((a) => provisioningRegistry.get(a.clientId));
    const anyWaiting = waitingActivations.length > 0 || provisioningRegistry.list().some(
      (w) => w.tenantPublicId === updated.product.tenant.publicId && w.productPublicId === updated.product.publicId
    );

    if (anyWaiting) {
      try {
        const reissued = await reissueCurrentLicense(updated.id);
        for (const a of waitingActivations) {
          const waiting = provisioningRegistry.get(a.clientId);
          if (waiting) {
            deliverProvisionedLicense(
              {
                clientId: a.clientId,
                tenantId: waiting.tenantPublicId,
                applicationId: waiting.productPublicId,
                hwid: waiting.hwid,
              },
              reissued.jwtKey
            );
          }
        }
      } catch (e) {
        console.error("Reissue on restore error:", e);
      }
    }
  } else {
    const event = targetStatus === "SUSPENDED" ? "LICENSE_SUSPENDED" : "LICENSE_REVOKED";
    await Promise.all(
      updated.activations.map(async (a) => {
        const live = registry.get(a.clientId);
        const delivered = await pushLicenseEvent(a.clientId, event, reason);
        if (live) {
          setTimeout(() => {
            if (!live.socket.destroyed) {
              live.socket.end();
              setTimeout(() => live.socket.destroy(), 500);
            }
          }, 500);
        }
        return delivered;
      })
    );
  }

  await prisma.auditLog.create({
    data: {
      action: `LICENSE_${targetStatus}_VIA_API`,
      entityType: "License",
      entityId: updated.id,
      severity: targetStatus === "ACTIVE" ? AuditSeverity.INFO : AuditSeverity.CRITICAL,
      details: {
        serial: updated.serial,
        apiKeyName: apiKey.name,
        newStatus: targetStatus,
        reason,
      },
    },
  });

  res.json({
    ok: true,
    serial: updated.serial,
    status: updated.status,
    revokeReason: updated.revokeReason,
    revokedAt: updated.revokedAt?.toISOString() || null,
    message: `License status successfully updated to ${targetStatus}`,
  });
});

// POST /api/v1/licenses/:serial/revoke - Revoke license convenience endpoint
apiV1Router.post("/licenses/:serial/revoke", async (req, res) => {
  req.body = { ...req.body, status: "REVOKED" };
  const serial = req.params.serial as string;
  const apiKey = req.apiKey!;

  if (apiKey.role === "READ_ONLY") {
    return res.status(403).json({ error: "This API key has READ_ONLY permissions. Revocation not permitted." });
  }

  const license = await prisma.license.findFirst({
    where: { serial, ...(apiKey.dealerId ? { dealerId: apiKey.dealerId } : {}) },
    include: { product: { include: { tenant: true } }, activations: true },
  });

  if (!license) return res.status(404).json({ error: "License not found or access denied" });

  const reason = (req.body && req.body.reason) || "Revoked via API";
  const updated = await prisma.license.update({
    where: { id: license.id },
    data: { status: "REVOKED", revokedAt: new Date(), revokeReason: reason },
  });

  await Promise.all(
    license.activations.map(async (a) => {
      const live = registry.get(a.clientId);
      const delivered = await pushLicenseEvent(a.clientId, "LICENSE_REVOKED", reason);
      if (live) {
        setTimeout(() => {
          if (!live.socket.destroyed) {
            live.socket.end();
            setTimeout(() => live.socket.destroy(), 500);
          }
        }, 500);
      }
      return delivered;
    })
  );

  await prisma.auditLog.create({
    data: {
      action: "LICENSE_REVOKED_VIA_API",
      entityType: "License",
      entityId: updated.id,
      severity: AuditSeverity.CRITICAL,
      details: { serial: updated.serial, apiKeyName: apiKey.name, reason },
    },
  });

  res.json({ ok: true, serial: updated.serial, status: "REVOKED", revokeReason: reason });
});

// POST /api/v1/licenses/:serial/restore - Restore license convenience endpoint
apiV1Router.post("/licenses/:serial/restore", async (req, res) => {
  const serial = req.params.serial as string;
  const apiKey = req.apiKey!;

  if (apiKey.role === "READ_ONLY") {
    return res.status(403).json({ error: "This API key has READ_ONLY permissions. Restoration not permitted." });
  }

  const license = await prisma.license.findFirst({
    where: { serial, ...(apiKey.dealerId ? { dealerId: apiKey.dealerId } : {}) },
    include: { product: { include: { tenant: true } }, activations: true },
  });

  if (!license) return res.status(404).json({ error: "License not found or access denied" });

  const reason = (req.body && req.body.reason) || "Restored via API";
  const updated = await prisma.license.update({
    where: { id: license.id },
    data: { status: "ACTIVE", revokedAt: null, revokeReason: null },
  });

  await Promise.all(
    license.activations.map(async (a) => {
      await pushLicenseEvent(a.clientId, "LICENSE_RESTORED", reason);
      await pushLicenseEvent(a.clientId, "REVALIDATE_NOW", reason);
    })
  );

  await prisma.auditLog.create({
    data: {
      action: "LICENSE_RESTORED_VIA_API",
      entityType: "License",
      entityId: updated.id,
      severity: AuditSeverity.INFO,
      details: { serial: updated.serial, apiKeyName: apiKey.name, reason },
    },
  });

  res.json({ ok: true, serial: updated.serial, status: "ACTIVE", message: "License restored successfully" });
});

// POST /api/v1/clients/:clientId/ban - Ban a specific client activation
apiV1Router.post("/clients/:clientId/ban", async (req, res) => {
  const clientId = req.params.clientId as string;
  const apiKey = req.apiKey!;

  if (apiKey.role === "READ_ONLY") {
    return res.status(403).json({ error: "This API key has READ_ONLY permissions. Mutation not permitted." });
  }

  const parsed = z
    .object({ reason: z.string().min(2).max(500).default("Banned via API") })
    .safeParse(req.body || {});

  const reason = parsed.success ? parsed.data.reason : "Banned via API";

  const activation = await prisma.activation.findFirst({
    where: {
      clientId,
      ...(apiKey.dealerId ? { license: { dealerId: apiKey.dealerId } } : {}),
    },
  });

  if (!activation) {
    return res.status(404).json({ error: "Client activation not found or access denied" });
  }

  await prisma.activation.update({
    where: { id: activation.id },
    data: {
      state: ClientState.BANNED,
      bannedAt: new Date(),
      banReason: reason,
    },
  });

  const live = registry.get(clientId);
  const delivered = await pushLicenseEvent(clientId, "CLIENT_BANNED", reason);
  if (live) setTimeout(() => live.socket.destroy(), 250);

  await prisma.auditLog.create({
    data: {
      action: "CLIENT_BANNED_VIA_API",
      entityType: "Activation",
      entityId: activation.id,
      severity: AuditSeverity.CRITICAL,
      details: { clientId, reason, apiKeyName: apiKey.name, delivered },
    },
  });

  res.json({ ok: true, clientId, state: "BANNED", banReason: reason, delivered });
});

// POST /api/v1/clients/:clientId/unban - Unban a client activation
apiV1Router.post("/clients/:clientId/unban", async (req, res) => {
  const clientId = req.params.clientId as string;
  const apiKey = req.apiKey!;

  if (apiKey.role === "READ_ONLY") {
    return res.status(403).json({ error: "This API key has READ_ONLY permissions. Mutation not permitted." });
  }

  const activation = await prisma.activation.findFirst({
    where: {
      clientId,
      ...(apiKey.dealerId ? { license: { dealerId: apiKey.dealerId } } : {}),
    },
  });

  if (!activation) {
    return res.status(404).json({ error: "Client activation not found or access denied" });
  }

  await prisma.activation.update({
    where: { id: activation.id },
    data: {
      state: ClientState.OFFLINE,
      bannedAt: null,
      banReason: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "CLIENT_UNBANNED_VIA_API",
      entityType: "Activation",
      entityId: activation.id,
      severity: AuditSeverity.INFO,
      details: { clientId, apiKeyName: apiKey.name },
    },
  });

  res.json({ ok: true, clientId, state: "OFFLINE", message: "Client successfully unbanned" });
});
