import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

export function normalizeClientHwid(hwid: string): string {
  return hwid.trim().toLowerCase().replace(/[^a-f0-9]/g, '');
}

/**
 * The client sends an application-scoped SHA-256 HWID. The server adds a
 * second non-public HMAC layer using the license id, so a database leak cannot
 * be used to correlate the client fingerprint across licenses.
 */
export function serverHwidHash(clientHwid: string, licenseId: string): string {
  const normalized = normalizeClientHwid(clientHwid);
  if (normalized.length !== 64) throw new Error('HWID must be a 64-character SHA-256 hex fingerprint');
  return createHmac('sha256', config.HWID_PEPPER).update(`lm-server-hwid-v2|${licenseId}|${normalized}`).digest('hex');
}

export function safeHashEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
