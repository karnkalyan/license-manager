import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { LicenseSystem, loadOrCreateScopedClientId } from '@license/node-sdk';

const TENANT_ID = process.env.LICENSE_TENANT_ID!;
const APPLICATION_ID = process.env.LICENSE_APPLICATION_ID!;
const storageDir = join(homedir(), '.example-app');
const clientId = await loadOrCreateScopedClientId(storageDir, TENANT_ID, APPLICATION_ID);

const license = new LicenseSystem({
  host: process.env.LICENSE_HOST ?? 'localhost',
  port: Number(process.env.LICENSE_PORT ?? 7443),
  tenantId: TENANT_ID,
  applicationId: APPLICATION_ID,
  clientId,
  licenseKey: process.env.LICENSE_KEY!,
  caPath: './certs/dev/ca-cert.pem',
  certPath: './certs/dev/client-cert.pem',
  keyPath: './certs/dev/client-key.pem',
  publicLicenseKeyPath: './certs/dev/license-ed25519-public.pem',
  servername: 'localhost',
  appVersion: '2.0.0',
  platform: platform(),
  onEntitlementsChanged(snapshot) {
    console.log('Licensed modules:', snapshot.modules);
  },
  onStateChange(event, reason) {
    console.log('License event:', event, reason ?? '');
  },
  onConnectionLost(error) {
    console.error('Fail closed - online validation lost:', error.message);
  }
});

const entitlement = await license.connect();
console.log('Validated for application', entitlement.applicationId);

if (license.hasModule('REPORTING')) {
  enableReporting();
}

license.requireModule('CORE'); // throws if CORE is not entitled

function enableReporting() {
  console.log('Reporting enabled');
}
