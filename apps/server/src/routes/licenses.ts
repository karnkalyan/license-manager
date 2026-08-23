import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { AuditSeverity, LicenseStatus } from "../generated/prisma/enums.js";
import { requireAdmin, requireRoles } from "../security/authMiddleware.js";
import { audit } from "../services/audit.js";
import {
  createLicense,
  reissueLicenseModules,
} from "../services/licenseService.js";
import { deliverProvisionedLicense, pushLicenseEvent } from "../tcp/server.js";
import { registry } from "../tcp/registry.js";
import { resolveProvisioningApplication } from "../services/provisioningService.js";
import {
  enabledCodes,
  validateClientEntitlements,
} from "../services/entitlementService.js";

export const licensesRouter = Router();
licensesRouter.use(requireAdmin);

const includeLicense = {
  product: {
    include: { tenant: true, modules: { orderBy: { code: "asc" as const } } },
  },
  modules: { include: { module: true } },
  activations: true,
};

licensesRouter.get("/", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const licenses = await prisma.license.findMany({
    where: q
      ? {
          OR: [
            { serial: { contains: q } },
            { customerRef: { contains: q } },
            { product: { name: { contains: q } } },
            {
              product: {
                tenant: { name: { contains: q } },
              },
            },
          ],
        }
      : undefined,
    include: includeLicense,
    orderBy: { createdAt: "desc" },
    take: 250,
  });
  const now = Date.now();
  res.json(
    licenses.map((l) => ({
      ...l,
      status:
        l.status === "ACTIVE" && l.expiresAt && l.expiresAt.getTime() <= now
          ? "EXPIRED"
          : l.status,
    })),
  );
});

licensesRouter.post(
  "/",
  requireRoles("SUPER_ADMIN", "ADMIN"),
  async (req, res) => {
    const parsed = z
      .object({
        provisioningId: z.string().min(1).max(8192),
        moduleIds: z.array(z.string().min(1)).max(100).default([]),
        entitlements: z
          .record(
            z.string(),
            z.union([z.boolean(), z.number().int().min(0).max(1_000_000)]),
          )
          .default({}),
        customerRef: z.string().max(120).optional(),
        customerName: z.string().min(2).max(120).optional(),
        customerEmail: z.string().email().max(254).optional(),
        autoActivate: z.boolean().default(true),
        expiresAt: z.coerce
          .date()
          .refine((d) => d.getTime() > Date.now(), {
            message: "Expiry must be in the future",
          })
          .optional(),
        maxActivations: z.number().int().min(1).max(50).default(1),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({
          error: "Invalid license input",
          details: parsed.error.flatten(),
        });
    try {
      const { payload, product } = await resolveProvisioningApplication(
        parsed.data.provisioningId,
      );
      const entitlements = validateClientEntitlements(
        payload,
        parsed.data.entitlements,
      );
      const selectedCodes = new Set(enabledCodes(entitlements));
      const moduleIds = product.modules
        .filter((module) => selectedCodes.has(module.code))
        .map((module) => module.id);
      const license = await createLicense({
        ...parsed.data,
        productId: product.id,
        moduleIds,
        entitlements,
        hwid: payload.hwid,
        customerRef: parsed.data.customerRef || parsed.data.customerName,
        metadata: {
          ...(parsed.data.metadata || {}),
          ...(parsed.data.customerName
            ? { customerName: parsed.data.customerName }
            : {}),
          ...(parsed.data.customerEmail
            ? { customerEmail: parsed.data.customerEmail }
            : {}),
        },
      });
      const autoDelivered =
        parsed.data.autoActivate &&
        deliverProvisionedLicense(
          {
            clientId: payload.clientId,
            tenantId: payload.tenantId,
            applicationId: payload.applicationId,
            hwid: payload.hwid,
          },
          license.jwtKey,
        );
      await audit(req, {
        action: "LICENSE_CREATED",
        entityType: "License",
        entityId: license.id,
        details: {
          serial: license.serial,
          tenantId: license.product.tenant.publicId,
          applicationId: license.product.publicId,
          entitlements,
        },
      });
      res
        .status(201)
        .json({
          ...license,
          autoDelivered,
          autoActivationRequested: parsed.data.autoActivate,
        });
    } catch (error) {
      res
        .status(400)
        .json({
          error:
            error instanceof Error ? error.message : "License creation failed",
        });
    }
  },
);

licensesRouter.post(
  "/:id/modules",
  requireRoles("SUPER_ADMIN", "ADMIN"),
  async (req, res) => {
    const id = req.params.id as string;
    const parsed = z
      .object({
        provisioningId: z.string().min(1).max(8192),
        moduleIds: z.array(z.string().min(1)).max(100),
        entitlements: z
          .record(
            z.string(),
            z.union([z.boolean(), z.number().int().min(0).max(1_000_000)]),
          )
          .default({}),
        customerName: z.string().min(2).max(120).optional(),
        customerEmail: z.string().email().max(254).optional(),
        autoActivate: z.boolean().default(true),
        expiresAt: z.coerce
          .date()
          .refine((d) => d.getTime() > Date.now(), {
            message: "Expiry must be in the future",
          })
          .optional(),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "Invalid module selection" });
    try {
      const [current, resolved] = await Promise.all([
        prisma.license.findUniqueOrThrow({
          where: { id },
          select: { productId: true },
        }),
        resolveProvisioningApplication(parsed.data.provisioningId),
      ]);
      if (current.productId !== resolved.product.id)
        throw new Error(
          "Client provisioning ID belongs to a different application",
        );
      const entitlements = validateClientEntitlements(
        resolved.payload,
        parsed.data.entitlements,
      );
      const selectedCodes = new Set(enabledCodes(entitlements));
      const moduleIds = resolved.product.modules
        .filter((module) => selectedCodes.has(module.code))
        .map((module) => module.id);
      const license = await reissueLicenseModules(id, moduleIds, {
        customerName: parsed.data.customerName,
        customerEmail: parsed.data.customerEmail,
        expiresAt: parsed.data.expiresAt,
        entitlements,
      });
      const activations = await prisma.activation.findMany({
        where: { licenseId: license.id },
      });
      await Promise.all(
        activations.map((a) =>
          pushLicenseEvent(
            a.clientId,
            "LICENSE_KEY_REISSUED",
            "License details or module entitlement changed.",
          ),
        ),
      );
      const autoDelivered =
        parsed.data.autoActivate &&
        deliverProvisionedLicense(
          {
            clientId: resolved.payload.clientId,
            tenantId: resolved.payload.tenantId,
            applicationId: resolved.payload.applicationId,
            hwid: resolved.payload.hwid,
          },
          license.jwtKey,
        );
      await audit(req, {
        action: "LICENSE_MODULES_REISSUED",
        entityType: "License",
        entityId: license.id,
        severity: AuditSeverity.WARNING,
        details: {
          entitlementVersion: license.entitlementVersion,
          entitlements,
        },
      });
      res.json({
        ...license,
        autoDelivered,
        autoActivationRequested: parsed.data.autoActivate,
      });
    } catch (error) {
      res
        .status(400)
        .json({
          error:
            error instanceof Error ? error.message : "Module update failed",
        });
    }
  },
);

licensesRouter.post(
  "/:id/status",
  requireRoles("SUPER_ADMIN", "ADMIN"),
  async (req, res) => {
    const id = req.params.id as string;
    const parsed = z
      .object({
        status: z.enum(["ACTIVE", "SUSPENDED", "REVOKED"]),
        reason: z.string().max(500).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "Invalid status" });
    const license = await prisma.license.update({
      where: { id },
      data: {
        status: parsed.data.status as LicenseStatus,
        revokedAt: parsed.data.status === "REVOKED" ? new Date() : null,
        revokeReason:
          parsed.data.status === "ACTIVE" ? null : parsed.data.reason,
      },
      include: includeLicense,
    });
    const event =
      parsed.data.status === "ACTIVE"
        ? "LICENSE_RESTORED"
        : parsed.data.status === "SUSPENDED"
          ? "LICENSE_SUSPENDED"
          : "LICENSE_REVOKED";
    await Promise.all(
      license.activations.map(async (a) => {
        const live = registry.get(a.clientId);
        const delivered = await pushLicenseEvent(
          a.clientId,
          event,
          parsed.data.reason,
        );
        if (parsed.data.status !== "ACTIVE" && live)
          setTimeout(() => live.socket.destroy(), 250);
        return delivered;
      }),
    );
    await audit(req, {
      action: `LICENSE_${parsed.data.status}`,
      entityType: "License",
      entityId: license.id,
      severity:
        parsed.data.status === "ACTIVE"
          ? AuditSeverity.INFO
          : AuditSeverity.CRITICAL,
      details: { reason: parsed.data.reason },
    });
    res.json(license);
  },
);
