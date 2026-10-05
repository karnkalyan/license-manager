import { Router } from 'express';
import argon2 from 'argon2';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../db.js';
import { signAdminToken } from '../security/adminJwt.js';
import { requireAdmin } from '../security/authMiddleware.js';
import { audit } from '../services/audit.js';
import { AuditSeverity } from '../generated/prisma/enums.js';
import { config } from '../config.js';

export const authRouter = Router();

function setSessionCookie(res: import('express').Response, token: string) {
  res.cookie('lm_admin', token, { httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: config.ADMIN_SESSION_MINUTES * 60_000 });
}
function clearSessionCookie(res: import('express').Response) {
  res.clearCookie('lm_admin', { httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: 'strict', path: '/' });
}
const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });

const loginSchema = z.object({ username: z.string().min(1).max(80), password: z.string().min(1).max(256) });

authRouter.post('/login', loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const user = await prisma.adminUser.findUnique({ where: { username: parsed.data.username } });
  if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.lockedUntil && user.lockedUntil > new Date()) return res.status(423).json({ error: 'Account temporarily locked' });

  const ok = await argon2.verify(user.passwordHash, parsed.data.password);
  if (!ok) {
    const count = user.failedLoginCount + 1;
    await prisma.adminUser.update({
      where: { id: user.id },
      data: { failedLoginCount: count, lockedUntil: count >= 5 ? new Date(Date.now() + 15 * 60_000) : null }
    });
    await prisma.auditLog.create({ data: { action: 'ADMIN_LOGIN_FAILED', entityType: 'AdminUser', entityId: user.id, severity: AuditSeverity.WARNING, ip: req.ip } });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  await prisma.adminUser.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
  const token = await signAdminToken(user);
  setSessionCookie(res, token);
  await prisma.auditLog.create({ data: { actorId: user.id, action: 'ADMIN_LOGIN', entityType: 'AdminUser', entityId: user.id, ip: req.ip } });
  return res.json({ user: { id: user.id, username: user.username, role: user.role, tenantId: user.tenantId, forcePasswordChange: user.forcePasswordChange } });
});

authRouter.get('/me', requireAdmin, async (req, res) => {
  const user = await prisma.adminUser.findUnique({ where: { id: req.admin!.id }, select: { id: true, username: true, role: true, tenantId: true, forcePasswordChange: true, tenant: { select: { id: true, name: true, code: true } } } });
  return res.json(user);
});

authRouter.post('/change-password', requireAdmin, async (req, res) => {
  const input = z.object({ currentPassword: z.string(), newPassword: z.string().min(12).max(256) }).safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: 'New password must be at least 12 characters' });
  const user = await prisma.adminUser.findUniqueOrThrow({ where: { id: req.admin!.id } });
  if (!(await argon2.verify(user.passwordHash, input.data.currentPassword))) return res.status(401).json({ error: 'Current password is incorrect' });
  const passwordHash = await argon2.hash(input.data.newPassword, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const updated = await prisma.adminUser.update({ where: { id: user.id }, data: { passwordHash, forcePasswordChange: false, tokenVersion: { increment: 1 } } });
  await audit(req, { action: 'ADMIN_PASSWORD_CHANGED', entityType: 'AdminUser', entityId: user.id, severity: AuditSeverity.WARNING });
  const token = await signAdminToken(updated);
  setSessionCookie(res, token);
  return res.json({ ok: true });
});


authRouter.post('/logout', requireAdmin, async (req, res) => {
  clearSessionCookie(res);
  await audit(req, { action: 'ADMIN_LOGOUT', entityType: 'AdminUser', entityId: req.admin!.id });
  return res.json({ ok: true });
});
