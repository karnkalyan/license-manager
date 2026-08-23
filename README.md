# Secure License Manager

A full-stack license management starter built with **React**, **Node.js/TypeScript**, **Prisma ORM**, and **MySQL**. It issues Ed25519-signed JWT license keys, binds activations to privacy-conscious HWIDs, maintains a TLS/TCP validation channel, and can immediately revoke a license or ban a specific connected installation.

## Included

- React admin panel with compact typography, responsive layout, light/dark mode, dashboard, licenses, live clients, products and audit trail.
- Node.js REST admin API.
- Node.js TLS 1.3 TCP license server on port `7443`.
- MySQL persistence through Prisma ORM.
- Ed25519 (`EdDSA`) signed JWT license keys and short-lived signed state events.
- HWID binding with local SHA-256 plus server-side HMAC-SHA256 pepper.
- mTLS support for application clients.
- Installation-specific `CLIENT_BANNED` and license-wide `REVOKED` / `SUSPENDED` states.
- Argon2id admin password hashing, login rate limits, temporary lockout, RBAC, HttpOnly session cookies, origin checks and session invalidation on password change.
- Security audit trail.
- Node.js client SDK plus language-neutral HWID/protocol documentation.

## Development setup

Requirements: Node.js 22.12+ (Node 24 LTS is a good production target), npm, MySQL 8+, and OpenSSL.

```bash
cp .env.example .env
./scripts/gen-dev-keys.sh
# Put the existing MySQL account password in this ignored local secret file.
mkdir -p secrets
printf '%s' 'your-mysql-password' > secrets/mysql_password.txt
npm install
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

Open the admin panel at `http://localhost:5173`.

Development bootstrap credentials requested for this project:

```text
username: admin
password: 123456
```

The seeded account has `forcePasswordChange=true`. The weak password is accepted **only when** `BOOTSTRAP_ALLOW_WEAK_PASSWORD=true`, and production startup refuses `123456` entirely.

## First license

1. Sign in to the admin panel.
2. Open **Licenses** → **Generate license**.
3. Paste the `KTX1…` provisioning ID displayed by the client. The manager identifies and locks the matching application and loads that client's advertised entitlement definitions.
4. Enable boolean features and enter numeric limits directly. The client defines every field, type, range, label and unit; License Manager contains no application-specific module or tier list.
5. Leave **Activate connected client automatically** enabled. If the installation is online and waiting on its mTLS provisioning channel, the manager securely delivers the JWT and the application activates without copy/paste. The generated JWT remains available for manual installation when the client is offline.

The plaintext key is never stored in MySQL; only its SHA-256 hash is retained server-side. Remote delivery is one-time over the mutually authenticated TLS connection. Reissues are also delivered to matching active clients over their existing validated session, so module/detail updates remain valid after restart without manual key replacement.

A raw 64-character app-scoped HWID cannot identify an application or advertise entitlements and therefore cannot be used to generate a new license. Applications define boolean features and integer limits in the provisioning payload; License Manager validates and signs only those client-declared fields.

## Node client example

```ts
import { LicenseClient, loadOrCreateClientId } from '@license/node-sdk';
import { join } from 'node:path';
import { homedir } from 'node:os';

const clientId = await loadOrCreateClientId(join(homedir(), '.my-app', 'license-client-id'));

const client = new LicenseClient({
  host: 'license.example.com',
  clientId,
  port: 7443,
  licenseKey: process.env.APP_LICENSE!,
  caPath: './certs/client-ca.pem',
  certPath: './certs/my-client-cert.pem',
  keyPath: './certs/my-client-key.pem',
  publicLicenseKeyPath: './license-ed25519-public.pem',
  appVersion: '1.0.0',
  platform: process.platform,
  onStateChange(event, reason) {
    if (event === 'LICENSE_REVOKED' || event === 'LICENSE_SUSPENDED' || event === 'LICENSE_EXPIRED' || event === 'CLIENT_BANNED') {
      disableLicensedFeatures(reason);
    }
  },
  onConnectionLost(error) {
    // Always-online policy: enter your fail-closed grace path here.
    disableLicensedFeatures(error.message);
  }
});

await client.connect();
```

## Important documentation

- `docs/ARCHITECTURE.md` — architecture and delivery plan.
- `docs/PROTOCOL.md` — single-channel TLS/TCP protocol.
- `docs/HWID-INTEGRATION.md` — cross-language HWID algorithm and examples.
- `docs/API.md` — admin REST endpoints.
- `docs/SECURITY.md` — production security model and deployment requirements.

## Production notes

Docker Compose deploys only License Manager; it does not create or run a MySQL image. Create the database on the existing MySQL server first:

```sql
CREATE DATABASE license_manager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Set strong `ADMIN_JWT_SECRET`, `HWID_PEPPER`, and `BOOTSTRAP_ADMIN_PASSWORD` values in the ignored `.env`, put the MySQL password in `secrets/mysql_password.txt`, generate the certificates, then deploy:

```bash
docker compose up -d --build
```

The admin application and API are served together on port `8081`; licensed clients connect to the TLS service on port `7443`. The default database host is `host.docker.internal`, configurable through `DATABASE_HOST`.

`DATABASE_ALLOW_PUBLIC_KEY_RETRIEVAL=true` is enabled by the Compose default for MySQL accounts using `caching_sha2_password` without database TLS. For a remote production database, configure MySQL TLS and disable public-key retrieval.

This repository is a secure foundation, not a claim that security ends at application code. Before production, use unique mTLS client certificates, a secrets manager, SSO/MFA for administrators, HTTPS for the admin API, KMS/HSM-backed signing or tightly protected keys, key rotation, SIEM/audit export, MySQL backups/PITR, network policy, monitoring, dependency scanning, and independent security testing.
