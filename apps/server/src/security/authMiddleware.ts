import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db.js';
import type { UserRole } from '../generated/prisma/enums.js';
import { verifyAdminToken } from './adminJwt.js';

function cookie(req: Request, name: string) {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const pair of raw.split(';')) {
    const [key, ...rest] = pair.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : cookie(req, 'lm_admin');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const claims = await verifyAdminToken(token);
    const user = await prisma.adminUser.findUnique({ where: { id: claims.id } });
    if (!user || !user.isActive || user.tokenVersion !== claims.tokenVersion) return res.status(401).json({ error: 'Unauthorized' });
    req.admin = { id: user.id, username: user.username, role: user.role, tenantId: user.tenantId };
    const rotationAllowed = req.originalUrl.startsWith('/api/auth/me') || req.originalUrl.startsWith('/api/auth/change-password') || req.originalUrl.startsWith('/api/auth/logout');
    if (user.forcePasswordChange && !rotationAllowed) {
      return res.status(403).json({ code: 'PASSWORD_CHANGE_REQUIRED', error: 'Password change required before administration is enabled' });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

export function requireRoles(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.admin || !roles.includes(req.admin.role)) return res.status(403).json({ error: 'Insufficient role' });
    next();
  };
}
