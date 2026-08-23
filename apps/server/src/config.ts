import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { z } from 'zod';

function findRepoRoot(start = process.cwd()) {
  let dir = resolve(start);
  for (let i = 0; i < 8; i++) {
    const pkg = resolve(dir, 'package.json');
    if (existsSync(pkg)) {
      try { const json = JSON.parse(readFileSync(pkg, 'utf8')); if (json.workspaces) return dir; } catch {}
    }
    const parent = dirname(dir); if (parent === dir) break; dir = parent;
  }
  return resolve(process.cwd(), '../..');
}

export const repoRoot = findRepoRoot();
dotenv.config({ path: resolve(repoRoot, '.env') });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8081),
  TCP_PORT: z.coerce.number().int().positive().default(7443),
  DATABASE_URL: z.string().min(1).optional(),
  DATABASE_HOST: z.string().min(1).default('localhost'),
  DATABASE_PORT: z.coerce.number().int().positive().max(65535).default(3306),
  DATABASE_USER: z.string().min(1).default('root'),
  DATABASE_PASSWORD: z.string().optional(),
  DATABASE_PASSWORD_FILE: z.string().optional(),
  DATABASE_NAME: z.string().regex(/^[a-zA-Z0-9_]+$/).default('license_manager'),
  DATABASE_ALLOW_PUBLIC_KEY_RETRIEVAL: z.string().default('false').transform(v => v === 'true'),
  ADMIN_ORIGIN: z.string().url().default('http://localhost:5173'),
  JWT_ISSUER: z.string().min(3).default('secure-license-manager'),
  JWT_AUDIENCE: z.string().min(1).default('licensed-app'),
  ADMIN_JWT_SECRET: z.string().min(32),
  ADMIN_SESSION_MINUTES: z.coerce.number().int().min(15).max(1440).default(480),
  HWID_PEPPER: z.string().min(32),
  LICENSE_PRIVATE_KEY_PATH: z.string().min(1),
  LICENSE_PUBLIC_KEY_PATH: z.string().min(1),
  TLS_KEY_PATH: z.string().min(1),
  TLS_CERT_PATH: z.string().min(1),
  TLS_CA_PATH: z.string().min(1),
  TLS_REQUIRE_CLIENT_CERT: z.string().default('true').transform(v => v === 'true'),
  TRUST_PROXY: z.string().default('false').transform(v => v === 'true'),
  BOOTSTRAP_ADMIN_USERNAME: z.string().default('admin'),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().default('123456'),
  BOOTSTRAP_ALLOW_WEAK_PASSWORD: z.string().default('false').transform(v => v === 'true')
});

const parsed = schema.parse(process.env);
const fromRoot = (value: string) => isAbsolute(value) ? value : resolve(repoRoot, value);
const readSecret = (inlineValue?: string, filePath?: string) => {
  if (inlineValue) return inlineValue;
  if (!filePath) return '';
  const resolvedPath = fromRoot(filePath);
  if (!existsSync(resolvedPath)) throw new Error(`Database password secret file not found: ${resolvedPath}`);
  return readFileSync(resolvedPath, 'utf8').trim();
};
const databasePassword = readSecret(parsed.DATABASE_PASSWORD, parsed.DATABASE_PASSWORD_FILE);
const databaseUrl = parsed.DATABASE_URL || [
  'mysql://',
  encodeURIComponent(parsed.DATABASE_USER),
  ':',
  encodeURIComponent(databasePassword),
  '@',
  parsed.DATABASE_HOST,
  ':',
  parsed.DATABASE_PORT,
  '/',
  parsed.DATABASE_NAME,
  parsed.DATABASE_ALLOW_PUBLIC_KEY_RETRIEVAL ? '?allowPublicKeyRetrieval=true' : ''
].join('');
export const config = {
  ...parsed,
  DATABASE_URL: databaseUrl,
  LICENSE_PRIVATE_KEY_PATH: fromRoot(parsed.LICENSE_PRIVATE_KEY_PATH),
  LICENSE_PUBLIC_KEY_PATH: fromRoot(parsed.LICENSE_PUBLIC_KEY_PATH),
  TLS_KEY_PATH: fromRoot(parsed.TLS_KEY_PATH),
  TLS_CERT_PATH: fromRoot(parsed.TLS_CERT_PATH),
  TLS_CA_PATH: fromRoot(parsed.TLS_CA_PATH)
};

if (config.NODE_ENV === 'production') {
  if (config.BOOTSTRAP_ADMIN_PASSWORD === '123456') {
    throw new Error('Production startup blocked: BOOTSTRAP_ADMIN_PASSWORD cannot be 123456.');
  }
  if (config.ADMIN_JWT_SECRET.toLowerCase().includes('change-me')) {
    throw new Error('Production startup blocked: ADMIN_JWT_SECRET must be a strong random secret.');
  }
  if (config.HWID_PEPPER.toLowerCase().includes('change-me')) {
    throw new Error('Production startup blocked: HWID_PEPPER must be a strong random secret.');
  }
}
