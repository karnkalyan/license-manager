import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAdmin } from '../security/authMiddleware.js';
import { registry } from '../tcp/registry.js';

export const dashboardRouter = Router();
dashboardRouter.use(requireAdmin);

dashboardRouter.get('/', async (req, res) => {
  const licenseScope = req.admin!.tenantId ? { product: { tenantId: req.admin!.tenantId } } : {};
  const activationScope = req.admin!.tenantId ? { license: { product: { tenantId: req.admin!.tenantId } } } : {};
  const scopedTenant = req.admin!.tenantId
    ? await prisma.tenant.findUnique({ where: { id: req.admin!.tenantId }, select: { publicId: true } })
    : null;
  const [licenses, active, revoked, activations, recentAudits] = await Promise.all([
    prisma.license.count({ where: licenseScope }),
    prisma.license.count({ where: { ...licenseScope, status: 'ACTIVE', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }),
    prisma.license.count({ where: { ...licenseScope, status: 'REVOKED' } }),
    prisma.activation.count({ where: activationScope }),
    prisma.auditLog.findMany({ where: req.admin!.tenantId ? { tenantId: req.admin!.tenantId } : undefined, orderBy: { createdAt: 'desc' }, take: 8, include: { actor: { select: { username: true } } } })
  ]);
  const online = scopedTenant
    ? registry.list().filter((client) => client.tenantPublicId === scopedTenant.publicId).length
    : registry.size();
  res.json({ licenses, active, revoked, activations, online, recentAudits: recentAudits.map(a => ({ ...a, id: a.id.toString() })) });
});
