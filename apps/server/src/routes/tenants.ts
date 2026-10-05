import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { TenantStatus } from '../generated/prisma/enums.js';
import { requireAdmin, requireRoles } from '../security/authMiddleware.js';
import { audit } from '../services/audit.js';
import { pushLicenseEvent } from '../tcp/server.js';
import { registry } from '../tcp/registry.js';

export const tenantsRouter = Router();
tenantsRouter.use(requireAdmin);

tenantsRouter.get('/', async (req, res) => {
  const tenants = await prisma.tenant.findMany({ where: req.admin!.tenantId ? { id: req.admin!.tenantId } : undefined, orderBy: { createdAt: 'desc' }, include: { _count: { select: { products: true } } } });
  res.json(tenants);
});

tenantsRouter.post('/', requireRoles('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const parsed = z.object({ code: z.string().regex(/^[A-Z0-9_-]{2,32}$/), name: z.string().min(2).max(100), description: z.string().max(500).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid vendor/tenant input', details: parsed.error.flatten() });
  const tenant = await prisma.tenant.create({ data: parsed.data });
  await audit(req, { action: 'TENANT_CREATED', entityType: 'Tenant', entityId: tenant.id, details: { code: tenant.code, publicId: tenant.publicId } });
  res.status(201).json(tenant);
});

tenantsRouter.post('/:id/status', requireRoles('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const id = req.params.id as string;
  const parsed = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid tenant status' });
  const tenant = await prisma.tenant.update({ where: { id }, data: { status: parsed.data.status as TenantStatus } });
  let delivered = 0;
  if (parsed.data.status === 'SUSPENDED') {
    const activations = await prisma.activation.findMany({ where: { tenantPublicId: tenant.publicId } });
    await Promise.all(activations.map(async activation => {
      const live = registry.get(activation.clientId);
      if (await pushLicenseEvent(activation.clientId, 'TENANT_SUSPENDED', 'Vendor/tenant suspended by administrator')) delivered += 1;
      if (live) setTimeout(() => live.socket.destroy(), 250);
    }));
  }
  await audit(req, { action: `TENANT_${parsed.data.status}`, entityType: 'Tenant', entityId: tenant.id, details: { publicId: tenant.publicId, delivered } });
  res.json({ ...tenant, delivered });
});
