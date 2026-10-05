import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { ClientState } from "../generated/prisma/enums.js";
import { requireAdmin, requireRoles } from "../security/authMiddleware.js";
import { audit } from "../services/audit.js";
import { pushLicenseEvent } from "../tcp/server.js";
import { deliverProvisionedLicense } from "../tcp/server.js";
import { provisioningRegistry, registry } from "../tcp/registry.js";
import {
  findActiveLicenseForInstallation,
  reissueCurrentLicense,
} from "../services/licenseService.js";

export const clientsRouter = Router();
clientsRouter.use(requireAdmin);

clientsRouter.get("/", async (req, res) => {
  const clients = await prisma.activation.findMany({
    where: req.admin!.tenantId ? { license: { product: { tenantId: req.admin!.tenantId } } } : undefined,
    include: {
      license: {
        include: {
          product: { include: { tenant: true } },
          modules: { include: { module: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  res.json(
    clients.map((c) => ({
      ...c,
      socketOnline: !!registry.get(c.clientId),
      provisioningOnline: !!provisioningRegistry.get(c.clientId),
    })),
  );
});

clientsRouter.post(
  "/:clientId/revalidate",
  requireRoles("SUPER_ADMIN", "ADMIN", "SUPPORT"),
  async (req, res) => {
    const clientId = req.params.clientId as string;
    if (req.admin!.tenantId) {
      await prisma.activation.findFirstOrThrow({ where: { clientId, license: { product: { tenantId: req.admin!.tenantId } } } });
    }
    let delivered = await pushLicenseEvent(clientId, "REVALIDATE_NOW");
    let reissued = false;
    if (!delivered) {
      const [activation, waiting] = await Promise.all([
        prisma.activation.findUniqueOrThrow({
          where: { clientId },
          include: { license: true },
        }),
        Promise.resolve(provisioningRegistry.get(clientId)),
      ]);
      if (!waiting)
        return res
          .status(409)
          .json({
            error:
              "Client is offline and is not waiting for secure revalidation",
            delivered: false,
          });
      if (
        waiting.tenantPublicId !== activation.tenantPublicId ||
        waiting.productPublicId !== activation.productPublicId
      )
        return res
          .status(409)
          .json({
            error:
              "Waiting client application identity does not match its activation",
          });
      const activeLicense = await findActiveLicenseForInstallation(
        activation.license.productId,
        clientId,
        waiting.hwid,
      );
      if (!activeLicense)
        return res.status(409).json({
          error:
            "No active, unexpired license is bound to this installation and application",
          delivered: false,
        });
      const license = await reissueCurrentLicense(activeLicense.id);
      delivered = deliverProvisionedLicense(
        {
          clientId,
          tenantId: waiting.tenantPublicId,
          applicationId: waiting.productPublicId,
          hwid: waiting.hwid,
        },
        license.jwtKey,
      );
      reissued = true;
    }
    await audit(req, {
      action: "CLIENT_REVALIDATE_PUSH",
      entityType: "Activation",
      entityId: clientId,
      details: { delivered, reissued },
    });
    res.json({ delivered, reissued });
  },
);

clientsRouter.post(
  "/:clientId/ban",
  requireRoles("SUPER_ADMIN", "ADMIN"),
  async (req, res) => {
    const clientId = req.params.clientId as string;
    const parsed = z
      .object({ reason: z.string().min(3).max(500) })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "Reason is required" });
    const activation = await prisma.activation.findFirstOrThrow({
      where: { clientId, ...(req.admin!.tenantId ? { license: { product: { tenantId: req.admin!.tenantId } } } : {}) },
    });
    await prisma.activation.update({
      where: { id: activation.id },
      data: {
        state: ClientState.BANNED,
        bannedAt: new Date(),
        banReason: parsed.data.reason,
      },
    });
    const live = registry.get(clientId);
    const delivered = await pushLicenseEvent(
      clientId,
      "CLIENT_BANNED",
      parsed.data.reason,
    );
    if (live) setTimeout(() => live.socket.destroy(), 250);
    await audit(req, {
      action: "CLIENT_BANNED",
      entityType: "Activation",
      entityId: activation.id,
      details: { reason: parsed.data.reason, delivered },
    });
    res.json({ ok: true, delivered });
  },
);

clientsRouter.post(
  "/:clientId/unban",
  requireRoles("SUPER_ADMIN", "ADMIN"),
  async (req, res) => {
    const clientId = req.params.clientId as string;
    const permitted = await prisma.activation.findFirstOrThrow({ where: { clientId, ...(req.admin!.tenantId ? { license: { product: { tenantId: req.admin!.tenantId } } } : {}) }, select: { id: true } });
    const activation = await prisma.activation.update({
      where: { id: permitted.id },
      data: { state: ClientState.OFFLINE, bannedAt: null, banReason: null },
    });
    await audit(req, {
      action: "CLIENT_UNBANNED",
      entityType: "Activation",
      entityId: activation.id,
      details: { clientId: activation.clientId },
    });
    res.json({ ok: true });
  },
);
