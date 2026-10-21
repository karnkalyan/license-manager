import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAdmin, requireRoles } from "../security/authMiddleware.js";
import { audit } from "../services/audit.js";

export const apiKeysRouter = Router();
apiKeysRouter.use(requireAdmin);

export function generateKtxKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(32);
  let token = "";
  for (let i = 0; i < 32; i++) {
    const b = bytes[i] ?? 0;
    token += chars[b % chars.length];
  }
  return `KTX_${token}`;
}

// List API Keys
apiKeysRouter.get("/", async (req, res) => {
  const isDealer = req.admin!.role === "DEALER" || req.admin!.role === "FRANCHISE";

  const keys = await prisma.apiKey.findMany({
    where: {
      ...(isDealer ? { dealerId: req.admin!.id } : {}),
    },
    include: {
      dealer: { select: { id: true, username: true, dealerName: true } },
      createdBy: { select: { id: true, username: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = Date.now();
  res.json(
    keys.map((k) => ({
      ...k,
      isExpired: k.expiresAt.getTime() <= now,
    })),
  );
});

// Generate new duration-based API Key
apiKeysRouter.post("/", async (req, res) => {
  const isDealer = req.admin!.role === "DEALER" || req.admin!.role === "FRANCHISE";

  const schema = z.object({
    name: z.string().min(2).max(120),
    allowedDomains: z
      .string()
      .trim()
      .default("*")
      .transform((val) => (val === "" ? "*" : val)),
    durationDays: z.coerce.number().int().min(1).max(3650).default(90),
    expiresAt: z.coerce.date().optional(),
    role: z.enum(["READ_EXTEND", "READ_ONLY", "FULL"]).default("READ_EXTEND"),
    dealerId: z.string().optional().nullable(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid API key parameters", details: parsed.error.flatten() });
  }

  // Calculate expiration date
  let expiresAt: Date;
  if (parsed.data.expiresAt && parsed.data.expiresAt.getTime() > Date.now()) {
    expiresAt = parsed.data.expiresAt;
  } else {
    expiresAt = new Date(Date.now() + parsed.data.durationDays * 24 * 60 * 60 * 1000);
  }

  const generatedKey = generateKtxKey();

  const apiKey = await prisma.apiKey.create({
    data: {
      key: generatedKey,
      name: parsed.data.name,
      allowedDomains: parsed.data.allowedDomains,
      role: parsed.data.role,
      dealerId: isDealer ? req.admin!.id : parsed.data.dealerId || null,
      createdById: req.admin!.id,
      expiresAt,
      isActive: true,
    },
    include: {
      dealer: { select: { id: true, username: true, dealerName: true } },
    },
  });

  await audit(req, {
    action: "API_KEY_GENERATED",
    entityType: "ApiKey",
    entityId: apiKey.id,
    details: {
      name: apiKey.name,
      allowedDomains: apiKey.allowedDomains,
      expiresAt: apiKey.expiresAt,
      role: apiKey.role,
    },
  });

  res.status(201).json(apiKey);
});

// Update/Toggle API Key status
apiKeysRouter.patch("/:id", async (req, res) => {
  const id = req.params.id as string;
  const isDealer = req.admin!.role === "DEALER" || req.admin!.role === "FRANCHISE";

  const schema = z.object({
    isActive: z.boolean().optional(),
    name: z.string().min(2).max(120).optional(),
    allowedDomains: z.string().optional(),
    extendDays: z.coerce.number().int().min(1).max(3650).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid update parameters" });

  const current = await prisma.apiKey.findUniqueOrThrow({ where: { id } });
  if (isDealer && current.dealerId !== req.admin!.id) {
    return res.status(403).json({ error: "Access denied" });
  }

  let nextExpiresAt = current.expiresAt;
  if (parsed.data.extendDays) {
    const base = current.expiresAt.getTime() > Date.now() ? current.expiresAt.getTime() : Date.now();
    nextExpiresAt = new Date(base + parsed.data.extendDays * 24 * 60 * 60 * 1000);
  }

  const updated = await prisma.apiKey.update({
    where: { id },
    data: {
      isActive: parsed.data.isActive ?? current.isActive,
      name: parsed.data.name ?? current.name,
      allowedDomains: parsed.data.allowedDomains ?? current.allowedDomains,
      expiresAt: nextExpiresAt,
    },
  });

  await audit(req, {
    action: "API_KEY_UPDATED",
    entityType: "ApiKey",
    entityId: id,
    details: { isActive: updated.isActive, expiresAt: updated.expiresAt },
  });

  res.json(updated);
});

// Delete API Key
apiKeysRouter.delete("/:id", async (req, res) => {
  const id = req.params.id as string;
  const isDealer = req.admin!.role === "DEALER" || req.admin!.role === "FRANCHISE";

  const current = await prisma.apiKey.findUniqueOrThrow({ where: { id } });
  if (isDealer && current.dealerId !== req.admin!.id) {
    return res.status(403).json({ error: "Access denied" });
  }

  await prisma.apiKey.delete({ where: { id } });

  await audit(req, {
    action: "API_KEY_DELETED",
    entityType: "ApiKey",
    entityId: id,
    details: { name: current.name },
  });

  res.json({ ok: true });
});
