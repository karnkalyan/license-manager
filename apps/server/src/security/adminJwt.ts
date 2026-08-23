import { jwtVerify, SignJWT } from 'jose';
import { TextEncoder } from 'node:util';
import { config } from '../config.js';
import type { UserRole } from '../generated/prisma/enums.js';

const secret = new TextEncoder().encode(config.ADMIN_JWT_SECRET);

export async function signAdminToken(user: { id: string; username: string; role: UserRole; tokenVersion: number }) {
  return new SignJWT({ username: user.username, role: user.role, ver: user.tokenVersion, typ: 'admin-access' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setIssuer(config.JWT_ISSUER)
    .setAudience('license-admin')
    .setIssuedAt()
    .setExpirationTime(`${config.ADMIN_SESSION_MINUTES}m`)
    .sign(secret);
}

export async function verifyAdminToken(token: string) {
  const { payload } = await jwtVerify(token, secret, {
    algorithms: ['HS256'],
    issuer: config.JWT_ISSUER,
    audience: 'license-admin'
  });
  if (payload.typ !== 'admin-access' || !payload.sub || typeof payload.username !== 'string' || typeof payload.role !== 'string' || typeof payload.ver !== 'number') {
    throw new Error('Invalid admin token');
  }
  return { id: payload.sub, username: payload.username, role: payload.role as UserRole, tokenVersion: payload.ver };
}
