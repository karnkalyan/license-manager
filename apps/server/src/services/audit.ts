import type { Request } from 'express';
import { prisma } from '../db.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AuditSeverity } from '../generated/prisma/enums.js';

function jsonSafe(value: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function audit(req: Request | undefined, data: {
  action: string;
  entityType: string;
  entityId?: string;
  severity?: AuditSeverity;
  details?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: req?.admin?.id,
      tenantId: req?.admin?.tenantId,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      severity: data.severity ?? AuditSeverity.INFO,
      ip: req?.ip,
      userAgent: req?.get('user-agent'),
      requestId: req?.requestId,
      details: data.details ? jsonSafe(data.details) : undefined
    }
  });
}
