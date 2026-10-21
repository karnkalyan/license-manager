import { Router } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAdmin, requireRoles } from "../security/authMiddleware.js";
import { audit } from "../services/audit.js";

export const dealersRouter = Router();
dealersRouter.use(requireAdmin);

// List dealers
dealersRouter.get("/", async (req, res) => {
  const isDealer = req.admin!.role === "DEALER" || req.admin!.role === "FRANCHISE";
  
  const dealers = await prisma.adminUser.findMany({
    where: {
      role: { in: ["DEALER", "FRANCHISE"] },
      ...(isDealer ? { id: req.admin!.id } : {}),
      ...(req.admin!.tenantId ? { tenantId: req.admin!.tenantId } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
      role: true,
      dealerName: true,
      dealerPhone: true,
      dealerEmail: true,
      notes: true,
      isActive: true,
      tenantId: true,
      tenant: { select: { id: true, name: true, code: true, publicId: true } },
      createdAt: true,
      lastLoginAt: true,
      dealerProducts: {
        include: {
          product: {
            select: { id: true, name: true, code: true, publicId: true, tenant: { select: { name: true, code: true } } },
          },
        },
      },
      _count: {
        select: {
          dealerLicenses: true,
        },
      },
    },
  });

  res.json(dealers);
});

// Create new dealer / franchise
dealersRouter.post("/", requireRoles("SUPER_ADMIN", "ADMIN"), async (req, res) => {
  const schema = z.object({
    username: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/),
    password: z.string().min(8).max(256),
    role: z.enum(["DEALER", "FRANCHISE"]).default("DEALER"),
    dealerName: z.string().min(2).max(120),
    dealerPhone: z.string().max(40).optional(),
    dealerEmail: z.string().email().optional(),
    notes: z.string().max(1000).optional(),
    tenantId: z.string().nullable().optional(),
    allowedProductIds: z.array(z.string()).default([]),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid dealer data", details: parsed.error.flatten() });
  }

  const existing = await prisma.adminUser.findUnique({ where: { username: parsed.data.username } });
  if (existing) {
    return res.status(409).json({ error: "Username already exists" });
  }

  const passwordHash = await argon2.hash(parsed.data.password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const dealer = await prisma.$transaction(async (tx) => {
    const user = await tx.adminUser.create({
      data: {
        username: parsed.data.username,
        passwordHash,
        role: parsed.data.role,
        dealerName: parsed.data.dealerName,
        dealerPhone: parsed.data.dealerPhone,
        dealerEmail: parsed.data.dealerEmail,
        notes: parsed.data.notes,
        tenantId: parsed.data.tenantId || null,
        forcePasswordChange: false,
      },
    });

    if (parsed.data.allowedProductIds.length > 0) {
      await tx.dealerProduct.createMany({
        data: parsed.data.allowedProductIds.map((productId) => ({
          userId: user.id,
          productId,
        })),
        skipDuplicates: true,
      });
    }

    return tx.adminUser.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        id: true,
        username: true,
        role: true,
        dealerName: true,
        dealerPhone: true,
        dealerEmail: true,
        notes: true,
        isActive: true,
        createdAt: true,
        tenantId: true,
        dealerProducts: {
          include: {
            product: {
              select: { id: true, name: true, code: true, publicId: true },
            },
          },
        },
      },
    });
  });

  await audit(req, {
    action: "DEALER_CREATED",
    entityType: "AdminUser",
    entityId: dealer.id,
    details: {
      username: dealer.username,
      dealerName: dealer.dealerName,
      role: dealer.role,
      assignedProductsCount: parsed.data.allowedProductIds.length,
    },
  });

  res.status(201).json(dealer);
});

// Get dealer by ID
dealersRouter.get("/:id", async (req, res) => {
  const id = req.params.id as string;
  const isDealer = req.admin!.role === "DEALER" || req.admin!.role === "FRANCHISE";
  if (isDealer && req.admin!.id !== id) {
    return res.status(403).json({ error: "Access denied. Cannot inspect other dealers." });
  }

  const dealer = await prisma.adminUser.findFirst({
    where: {
      id,
      role: { in: ["DEALER", "FRANCHISE"] },
    },
    select: {
      id: true,
      username: true,
      role: true,
      dealerName: true,
      dealerPhone: true,
      dealerEmail: true,
      notes: true,
      isActive: true,
      tenantId: true,
      createdAt: true,
      lastLoginAt: true,
      dealerProducts: {
        include: {
          product: {
            include: { tenant: true, modules: true },
          },
        },
      },
      dealerLicenses: {
        include: {
          product: { include: { tenant: true } },
          activations: true,
          modules: { include: { module: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!dealer) return res.status(404).json({ error: "Dealer not found" });
  res.json(dealer);
});

// Update dealer
dealersRouter.patch("/:id", requireRoles("SUPER_ADMIN", "ADMIN"), async (req, res) => {
  const id = req.params.id as string;
  const schema = z.object({
    dealerName: z.string().min(2).max(120).optional(),
    dealerPhone: z.string().max(40).optional().nullable(),
    dealerEmail: z.string().email().optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    isActive: z.boolean().optional(),
    role: z.enum(["DEALER", "FRANCHISE"]).optional(),
    password: z.string().min(8).max(256).optional(),
    allowedProductIds: z.array(z.string()).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid update", details: parsed.error.flatten() });

  const current = await prisma.adminUser.findFirstOrThrow({
    where: { id, role: { in: ["DEALER", "FRANCHISE"] } },
  });

  const passwordHash = parsed.data.password
    ? await argon2.hash(parsed.data.password, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      })
    : undefined;

  const updated = await prisma.$transaction(async (tx) => {
    if (parsed.data.allowedProductIds !== undefined) {
      await tx.dealerProduct.deleteMany({ where: { userId: id } });
      if (parsed.data.allowedProductIds.length > 0) {
        await tx.dealerProduct.createMany({
          data: parsed.data.allowedProductIds.map((productId) => ({
            userId: id,
            productId,
          })),
          skipDuplicates: true,
        });
      }
    }

    return tx.adminUser.update({
      where: { id },
      data: {
        dealerName: parsed.data.dealerName,
        dealerPhone: parsed.data.dealerPhone,
        dealerEmail: parsed.data.dealerEmail,
        notes: parsed.data.notes,
        isActive: parsed.data.isActive,
        role: parsed.data.role,
        ...(passwordHash ? { passwordHash, tokenVersion: { increment: 1 } } : {}),
      },
      select: {
        id: true,
        username: true,
        role: true,
        dealerName: true,
        dealerPhone: true,
        dealerEmail: true,
        notes: true,
        isActive: true,
        dealerProducts: {
          include: {
            product: { select: { id: true, name: true, code: true, publicId: true } },
          },
        },
      },
    });
  });

  await audit(req, {
    action: "DEALER_UPDATED",
    entityType: "AdminUser",
    entityId: id,
    details: { username: current.username, isActive: updated.isActive },
  });

  res.json(updated);
});

// Delete dealer
dealersRouter.delete("/:id", requireRoles("SUPER_ADMIN", "ADMIN"), async (req, res) => {
  const id = req.params.id as string;
  const current = await prisma.adminUser.findFirstOrThrow({
    where: { id, role: { in: ["DEALER", "FRANCHISE"] } },
  });

  await prisma.adminUser.delete({ where: { id } });

  await audit(req, {
    action: "DEALER_DELETED",
    entityType: "AdminUser",
    entityId: id,
    details: { username: current.username, dealerName: current.dealerName },
  });

  res.json({ ok: true });
});
