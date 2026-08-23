import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAdmin } from '../security/authMiddleware.js';

export const auditRouter = Router();
auditRouter.use(requireAdmin);

auditRouter.get('/', async (_req, res) => {
  const rows = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 500, include: { actor: { select: { username: true } } } });
  res.json(rows.map(row => ({ ...row, id: row.id.toString() })));
});
