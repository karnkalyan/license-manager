import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAdmin } from '../security/authMiddleware.js';

export const auditRouter = Router();
auditRouter.use(requireAdmin);

auditRouter.get('/', async (req, res) => {
  const rows = await prisma.auditLog.findMany({ where: req.admin!.tenantId ? { tenantId: req.admin!.tenantId } : undefined, orderBy: { createdAt: 'desc' }, take: 500, include: { actor: { select: { username: true } } } });
  res.json(rows.map(row => ({ ...row, id: row.id.toString() })));
});
