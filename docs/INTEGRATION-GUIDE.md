# Secure License Manager - Integration Guide

## 1. What the application integrates

Every licensed application embeds only public configuration and client credentials:

- License server hostname/port.
- Vendor/tenant public UUID.
- Application public UUID.
- Ed25519 public license verification key.
- TLS CA trust anchor.
- Preferably a unique mTLS client certificate/key provisioned for that installation.
- The user's JWT license key, stored using OS-protected application storage when available.

Never embed the Ed25519 private signing key, HWID pepper, admin JWT secret, database password, CA private key, or admin credentials.

## 2. Namespace model

```text
Tenant/Vendor A (UUID A)
  Application Desktop (UUID A1)
    CORE
    REPORTING
  Application Agent (UUID A2)
    CORE

Tenant/Vendor B (UUID B)
  Application Desktop (UUID B1)
    CORE
    REPORTING
```

Even when Vendor A and Vendor B sell applications with the same name/code, their tenant/application UUIDs are different. The client HWID, license JWT claims, database relationships, activation binding and signed events all include the namespace.

## 3. Generate the application-scoped HWID

Use the SDK rather than a global HWID:

```ts
const hwid = await generateHwid({ tenantId: TENANT_ID, applicationId: APPLICATION_ID });
```

On the same physical machine, `A/A1`, `A/A2`, and `B/B1` intentionally produce three different 64-character HWIDs.

## 4. Create a persistent installation ID

```ts
const clientId = await loadOrCreateScopedClientId(
  join(homedir(), '.my-product'),
  TENANT_ID,
  APPLICATION_ID
);
```

Persist this random UUID. Do not derive it from hardware.

## 5. Create the reusable client system

```ts
import { LicenseSystem, loadOrCreateScopedClientId } from '@license/node-sdk';

const license = new LicenseSystem({
  host: 'license.example.com',
  port: 7443,
  tenantId: TENANT_ID,
  applicationId: APPLICATION_ID,
  clientId,
  licenseKey: readLicenseFromSecureStorage(),
  caPath: './license-ca.pem',
  certPath: './client-cert.pem',
  keyPath: './client-key.pem',
  publicLicenseKeyPath: './license-ed25519-public.pem',
  expectedIssuer: 'secure-license-manager',
  expectedAudience: 'licensed-app',
  appVersion: APP_VERSION,
  platform: process.platform,
  onEntitlementsChanged(snapshot) {
    applyFeatureState(snapshot.modules);
  },
  onStateChange(event, reason) {
    if (['LICENSE_REVOKED','LICENSE_SUSPENDED','LICENSE_EXPIRED','CLIENT_BANNED','TENANT_SUSPENDED'].includes(event)) {
      disableLicensedFeatures(reason);
    }
    if (event === 'LICENSE_KEY_REISSUED') {
      showReplacementKeyRequiredMessage();
    }
  },
  onConnectionLost(error) {
    // Always-online policy: fail closed after validation timeout.
    disableLicensedFeatures(error.message);
  }
});

const entitlements = await license.connect();
```

`connect()` returns only after TLS authentication, JWT/database validation, namespace checks, activation/HWID checks, and module entitlement retrieval succeed.

## 6. Gate application modules

Do not parse the JWT in business logic. Use the validated session:

```ts
if (license.hasModule('REPORTING')) {
  showReportingMenu();
}

license.requireModule('EXPORT_PDF');
performPdfExport();
```

Use `requireModule()` again at sensitive execution boundaries, not only at menu rendering.

## 7. Read all licensed modules

For security, the server never authorizes or reveals a customer entitlement from HWID alone. The application sends its app-scoped HWID as one binding signal, but the module list is returned only after the JWT key, tenant/application namespace, database state, activation policy and TLS identity all validate.

```ts
const modules = license.getModules();
const snapshot = license.getEntitlements();
```

A snapshot includes tenant ID, application ID, license ID, modules, entitlement version and validation timestamp.

## 8. Refresh modules at runtime

```ts
const fresh = await license.refreshEntitlements();
console.log(fresh.modules);
```

The server returns an Ed25519-signed entitlement snapshot through the existing TCP channel. The SDK checks scope, sequence, expiration and signed module contents before replacing its cache.

## 9. Module changes

An administrator can change a license's selected modules. The manager increments `entitlementVersion`, reissues the license JWT, invalidates the old token hash for future connections, and pushes `LICENSE_KEY_REISSUED` to live activations.

Call `license.setLicenseKey(replacementJwt)` after securely receiving the new key, persist it, then reconnect when appropriate.

## 10. Ban/revoke behavior

- **Client ban**: blocks one installation/client UUID.
- **License revoke/suspend**: blocks every activation using that license.
- **Tenant suspend**: blocks every application/license below the tenant.
- **Expiry**: blocks the license after `expiresAt`.

The database is changed first; push notification is only the fast path. Offline clients are rejected on reconnect.

## 11. Generic implementation contract for other languages

A client in any language must implement this interface:

```text
LicenseSystem.connect() -> EntitlementSnapshot
LicenseSystem.close()
LicenseSystem.isLicensed() -> bool
LicenseSystem.getModules() -> string[]
LicenseSystem.hasModule(code) -> bool
LicenseSystem.requireModule(code) -> throws/denies
LicenseSystem.refreshEntitlements() -> EntitlementSnapshot
LicenseSystem.setLicenseKey(reissuedJwt)
```

Required internals:

1. TLS 1.3 server certificate validation; mTLS client certificate in production.
2. Application-scoped HWID v2 algorithm from `HWID-INTEGRATION.md`.
3. Persistent random installation UUID.
4. NDJSON protocol v2 HELLO/HEARTBEAT/ENTITLEMENTS_REQUEST.
5. Ed25519 verification of state/entitlement JWTs with exact issuer/audience.
6. Verify signed client ID, tenant UUID, application UUID, license ID, event, expiration and monotonic sequence.
7. Fail closed when heartbeat acknowledgements exceed the allowed validation timeout.
8. Never implement an arbitrary remote command handler.

## 12. Server/admin provisioning flow

1. Create Vendor/Tenant.
2. Copy its public tenant UUID.
3. Create Application inside that tenant.
4. Copy its public application UUID.
5. Add application Modules.
6. Generate License, selecting only authorized modules.
7. Deliver the one-time JWT to the customer's application securely.
8. Application generates scoped HWID and persistent client UUID, then connects.
9. Admin monitors activation, heartbeat and audit logs; ban/revoke if necessary.

## 13. Recommended secure key storage

- Windows: DPAPI / Credential Manager.
- macOS: Keychain.
- Linux desktop: Secret Service/libsecret where available; otherwise a root/user-protected file with restrictive permissions and disk encryption.
- Containers/services: secrets manager or orchestrator secret mount.

Never put the license JWT in command-line arguments, crash dumps, telemetry, analytics, URL query strings, or normal logs.

## 14. Production checklist

Use unique production secrets/certificates; enforce mTLS; protect signing keys with KMS/HSM; deploy admin HTTPS + SSO/MFA; use MySQL TLS/least privilege/backups; add handshake rate limits; export audit logs to SIEM; add pub/sub before scaling TCP nodes; test ban/revoke/expiry/network-loss scenarios; fuzz the protocol; and perform independent security testing.
