import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAdmin, requireRoles } from "../security/authMiddleware.js";
import { audit } from "../services/audit.js";
import { resolveProvisioningApplication } from "../services/provisioningService.js";

export const productsRouter = Router();
productsRouter.use(requireAdmin);

productsRouter.get("/", async (_req, res) => {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      tenant: true,
      modules: { orderBy: { code: "asc" } },
      _count: { select: { licenses: true } },
    },
  });
  res.json(products);
});

productsRouter.post(
  "/",
  requireRoles("SUPER_ADMIN", "ADMIN"),
  async (req, res) => {
    const parsed = z
      .object({
        tenantId: z.string().min(1),
        code: z.string().regex(/^[A-Z0-9_-]{2,32}$/),
        name: z.string().min(2).max(100),
        description: z.string().max(500).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({
          error: "Invalid application input",
          details: parsed.error.flatten(),
        });
    const product = await prisma.product.create({
      data: parsed.data,
      include: { tenant: true, modules: true },
    });
    await audit(req, {
      action: "APPLICATION_CREATED",
      entityType: "Product",
      entityId: product.id,
      details: {
        code: product.code,
        publicId: product.publicId,
        tenantPublicId: product.tenant.publicId,
      },
    });
    res.status(201).json(product);
  },
);

productsRouter.post(
  "/resolve-provisioning",
  requireRoles("SUPER_ADMIN", "ADMIN"),
  async (req, res) => {
    const parsed = z
      .object({ provisioningId: z.string().min(1).max(8192) })
      .safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: "Client provisioning ID is required" });
    try {
      const { payload, product } = await resolveProvisioningApplication(
        parsed.data.provisioningId,
      );
      await audit(req, {
        action: "CLIENT_MODULE_CATALOG_SYNCED",
        entityType: "Product",
        entityId: product.id,
        details: {
          applicationId: product.publicId,
          modules: payload.modules.map((module) => module.code),
        },
      });
      res.json({ product, hwid: payload.hwid, capabilities: payload.modules });
    } catch (error) {
      res
        .status(400)
        .json({
          error:
            error instanceof Error
              ? error.message
              : "Invalid client provisioning ID",
        });
    }
  },
);

productsRouter.patch(
  "/:productId/modules/:moduleId",
  requireRoles("SUPER_ADMIN", "ADMIN"),
  async (req, res) => {
    const productId = req.params.productId as string;
    const moduleId = req.params.moduleId as string;
    const parsed = z.object({ enabled: z.boolean() }).safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "Invalid module update" });
    const module = await prisma.module.findFirstOrThrow({
      where: { id: moduleId, productId },
    });
    if (!parsed.data.enabled) {
      const assigned = await prisma.licenseModule.count({
        where: { moduleId: module.id },
      });
      if (assigned > 0)
        return res
          .status(409)
          .json({
            error: `Module is assigned to ${assigned} license(s). Reissue those licenses without this module before disabling it.`,
          });
    }
    const updated = await prisma.module.update({
      where: { id: module.id },
      data: { enabled: parsed.data.enabled },
    });
    await audit(req, {
      action: parsed.data.enabled ? "MODULE_ENABLED" : "MODULE_DISABLED",
      entityType: "Module",
      entityId: module.id,
    });
    res.json(updated);
  },
);
