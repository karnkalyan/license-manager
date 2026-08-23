import argon2 from 'argon2';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { config } from '../src/config.js';

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(config.DATABASE_URL, { database: config.DATABASE_NAME }) });

const DEV_TENANT_PUBLIC_ID = '11111111-1111-4111-8111-111111111111';
const DEV_APP_PUBLIC_ID = '22222222-2222-4222-8222-222222222222';

async function main() {
  if (config.NODE_ENV === 'production' && config.BOOTSTRAP_ADMIN_PASSWORD === '123456') throw new Error('Weak bootstrap password refused in production');
  if (config.BOOTSTRAP_ADMIN_PASSWORD === '123456' && !config.BOOTSTRAP_ALLOW_WEAK_PASSWORD) throw new Error('Set BOOTSTRAP_ALLOW_WEAK_PASSWORD=true only for local development');
  const passwordHash = await argon2.hash(config.BOOTSTRAP_ADMIN_PASSWORD, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  await prisma.adminUser.upsert({
    where: { username: config.BOOTSTRAP_ADMIN_USERNAME },
    create: { username: config.BOOTSTRAP_ADMIN_USERNAME, passwordHash, role: 'SUPER_ADMIN', forcePasswordChange: true },
    update: {}
  });

  const tenant = await prisma.tenant.upsert({
    where: { code: 'OMNI_VENDOR' },
    create: { code: 'OMNI_VENDOR', name: 'Omni Vendor', description: 'Default development tenant.', publicId: DEV_TENANT_PUBLIC_ID },
    update: {}
  });
  const product = await prisma.product.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'OMNI_APP' } },
    create: { tenantId: tenant.id, code: 'OMNI_APP', name: 'Omni Application', description: 'Default multi-module licensed application.', publicId: DEV_APP_PUBLIC_ID },
    update: {}
  });
  for (const module of [
    { code: 'CORE', name: 'Core', description: 'Core application functionality.' },
    { code: 'REPORTING', name: 'Reporting', description: 'Reporting and export features.' },
    { code: 'AUTOMATION', name: 'Automation', description: 'Automation and workflow features.' }
  ]) {
    await prisma.module.upsert({ where: { productId_code: { productId: product.id, code: module.code } }, create: { ...module, productId: product.id }, update: {} });
  }
  console.log(`Seeded admin '${config.BOOTSTRAP_ADMIN_USERNAME}', tenant OMNI_VENDOR, application OMNI_APP and example modules.`);
  console.log(`Development tenantId=${DEV_TENANT_PUBLIC_ID} applicationId=${DEV_APP_PUBLIC_ID}`);
}

main().finally(async () => { await prisma.$disconnect(); });
