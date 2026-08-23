import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAdmin } from '../security/authMiddleware.js';
import { registry } from '../tcp/registry.js';

export const dashboardRouter = Router();
dashboardRouter.use(requireAdmin);

dashboardRouter.get('/', async (_req, res) => {
  const [licenses, active, revoked, activations, recentAudits] = await Promise.all([
    prisma.license.count(),
    prisma.license.count({ where: { status: 'ACTIVE', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }),
    prisma.license.count({ where: { status: 'REVOKED' } }),
    prisma.activation.count(),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 8, include: { actor: { select: { username: true } } } })
  ]);
  res.json({ licenses, active, revoked, activations, online: registry.size(), recentAudits: recentAudits.map(a => ({ ...a, id: a.id.toString() })) });
});
