import { Router } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "../db.js";
import { UserRole } from "../generated/prisma/enums.js";
import { requireAdmin, requireRoles } from "../security/authMiddleware.js";
import { audit } from "../services/audit.js";

export const usersRouter = Router();
usersRouter.use(requireAdmin, requireRoles("SUPER_ADMIN", "ADMIN"));

const roleSchema = z.enum(["SUPER_ADMIN", "ADMIN", "SUPPORT", "MONITORING", "VENDOR", "AUDITOR"]);

function canAssign(actorRole: UserRole, role: UserRole) {
  return actorRole === "SUPER_ADMIN" || role !== "SUPER_ADMIN";
}

usersRouter.get("/", async (_req, res) => {
  const users = await prisma.adminUser.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
      role: true,
      isActive: true,
      forcePasswordChange: true,
      lastLoginAt: true,
      createdAt: true,
      tenantId: true,
      tenant: { select: { id: true, name: true, code: true } },
    },
  });
  res.json(users);
});

usersRouter.post("/", async (req, res) => {
  const parsed = z.object({
    username: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/),
    password: z.string().min(12).max(256),
    role: roleSchema,
    tenantId: z.string().nullable().optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid user details", details: parsed.error.flatten() });
  if (!canAssign(req.admin!.role, parsed.data.role as UserRole)) return res.status(403).json({ error: "Only a super administrator can assign that role" });
  if (parsed.data.role === "VENDOR" && !parsed.data.tenantId) return res.status(400).json({ error: "Vendor users must be assigned to a vendor" });
  const passwordHash = await argon2.hash(parsed.data.password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  try {
    const user = await prisma.adminUser.create({
      data: {
        username: parsed.data.username,
        passwordHash,
        role: parsed.data.role as UserRole,
        tenantId: parsed.data.role === "VENDOR" ? parsed.data.tenantId : null,
        forcePasswordChange: true,
      },
      select: { id: true, username: true, role: true, tenantId: true, isActive: true, forcePasswordChange: true, createdAt: true, tenant: { select: { id: true, name: true, code: true } } },
    });
    await audit(req, { action: "USER_CREATED", entityType: "AdminUser", entityId: user.id, details: { username: user.username, role: user.role, tenantId: user.tenantId } });
    res.status(201).json(user);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) return res.status(409).json({ error: "Username already exists" });
    throw error;
  }
});

usersRouter.patch("/:id", async (req, res) => {
  const id = req.params.id as string;
  const parsed = z.object({
    role: roleSchema.optional(),
    tenantId: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(12).max(256).optional(),
  }).refine((value) => Object.keys(value).length > 0).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid user update" });
  const current = await prisma.adminUser.findUniqueOrThrow({ where: { id } });
  const nextRole = (parsed.data.role ?? current.role) as UserRole;
  if (!canAssign(req.admin!.role, current.role) || !canAssign(req.admin!.role, nextRole)) return res.status(403).json({ error: "Only a super administrator can manage super administrators" });
  if (id === req.admin!.id && parsed.data.isActive === false) return res.status(400).json({ error: "You cannot disable your own account" });
  const tenantId = nextRole === "VENDOR" ? (parsed.data.tenantId === undefined ? current.tenantId : parsed.data.tenantId) : null;
  if (nextRole === "VENDOR" && !tenantId) return res.status(400).json({ error: "Vendor users must be assigned to a vendor" });
  const passwordHash = parsed.data.password
    ? await argon2.hash(parsed.data.password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 })
    : undefined;
  const user = await prisma.adminUser.update({
    where: { id },
    data: {
      role: nextRole,
      tenantId,
      isActive: parsed.data.isActive,
      passwordHash,
      forcePasswordChange: passwordHash ? true : undefined,
      tokenVersion: { increment: 1 },
    },
    select: { id: true, username: true, role: true, tenantId: true, isActive: true, forcePasswordChange: true, createdAt: true, lastLoginAt: true, tenant: { select: { id: true, name: true, code: true } } },
  });
  await audit(req, { action: "USER_UPDATED", entityType: "AdminUser", entityId: user.id, details: { username: user.username, role: user.role, tenantId: user.tenantId, isActive: user.isActive } });
  res.json(user);
});

usersRouter.delete("/:id", async (req, res) => {
  const id = req.params.id as string;
  if (id === req.admin!.id) return res.status(400).json({ error: "You cannot delete your own account" });
  const current = await prisma.adminUser.findUniqueOrThrow({ where: { id } });
  if (!canAssign(req.admin!.role, current.role)) return res.status(403).json({ error: "Only a super administrator can delete a super administrator" });
  await prisma.adminUser.delete({ where: { id } });
  await audit(req, { action: "USER_DELETED", entityType: "AdminUser", entityId: id, details: { username: current.username, role: current.role } });
  res.json({ ok: true });
});
