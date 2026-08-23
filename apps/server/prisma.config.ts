import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

dotenv.config({ path: resolve(process.cwd(), '../../.env') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

const rootDir = resolve(process.cwd(), '../..');
const passwordFile = process.env.DATABASE_PASSWORD_FILE;
const passwordPath = passwordFile
  ? (isAbsolute(passwordFile) ? passwordFile : resolve(rootDir, passwordFile))
  : '';
const password = process.env.DATABASE_PASSWORD || (passwordPath && existsSync(passwordPath)
  ? readFileSync(passwordPath, 'utf8').trim()
  : '');
const databaseUrl = process.env.DATABASE_URL || [
  'mysql://',
  encodeURIComponent(process.env.DATABASE_USER || 'root'),
  ':',
  encodeURIComponent(password),
  '@',
  process.env.DATABASE_HOST || 'localhost',
  ':',
  process.env.DATABASE_PORT || '3306',
  '/',
  process.env.DATABASE_NAME || 'license_manager',
  process.env.DATABASE_ALLOW_PUBLIC_KEY_RETRIEVAL === 'true' ? '?allowPublicKeyRetrieval=true' : ''
].join('');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: databaseUrl }
});
