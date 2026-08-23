# Security Model and Production Checklist

## Implemented controls

- Ed25519 (`EdDSA`) allow-listed JWT signatures.
- Tenant and application UUIDs bound into license JWT claims and every client handshake.
- Module entitlement list and entitlement version signed into the license JWT.
- Application-scoped client HWID: same hardware produces different fingerprints for different tenant/application namespaces.
- Server-side HMAC-SHA256 of client HWID using a non-public pepper and license-specific context.
- Plaintext license JWT stored only at issuance response; MySQL stores SHA-256 token hash.
- TLS 1.3 with optional/production-required mTLS.
- Activation-to-client UUID, HWID, tenant/application namespace and client-certificate fingerprint checks.
- Serializable activation transaction plus MySQL row lock for activation-count races.
- Always-online heartbeat and client-side validation watchdog.
- MySQL-authoritative revoke/suspend/ban/expiry checks.
- Ed25519-signed, short-lived, sequenced state events and entitlement snapshots.
- No arbitrary server-to-client command execution.
- Argon2id admin password hashing, login throttling/lockout, RBAC, HttpOnly SameSite session cookies, origin checks, audit logs and token-version invalidation.
- Weak `admin / 123456` credential limited to an explicitly enabled development bootstrap and refused in production.

## Critical integration rules

1. Never ship the Ed25519 **private** signing key, HWID pepper, admin JWT secret, database credentials, or CA private key in an application client.
2. Public tenant UUID, application UUID, server hostname, CA trust anchor/client certificate, and Ed25519 **public** verification key may be distributed as application configuration.
3. Do not unlock features by decoding the license JWT locally. Treat `LicenseSystem.connect()` / signed online entitlement state as the authorization source.
4. Deny licensed features when always-online validation exceeds the configured timeout.
5. Use `hasModule()` or `requireModule()` immediately before sensitive feature entry points; do not rely only on hiding a UI button.
6. Store a reissued JWT in OS-protected application storage where available. Never log it.
7. Treat HWID as non-secret and potentially clonable. It is one signal combined with client ID, online state, activation limits and preferably mTLS.

## Production requirements

- Replace development certificates with a managed private PKI; issue a distinct client certificate per installation/device enrollment when practical.
- Protect signing material with KMS/HSM or a hardened signing service rather than a general application filesystem.
- Add signing-key rotation using `kid` with overlapping verification windows.
- Add SSO/MFA for administrators and remove password bootstrap after initial provisioning.
- Terminate the admin API behind HTTPS and a trusted reverse proxy/WAF; restrict TCP exposure to required networks where possible.
- Store secrets in a secrets manager and rotate them.
- Encrypt MySQL at rest, enforce TLS to MySQL, use least-privilege roles, backups and PITR.
- Export audit/security events to a SIEM; alert on repeated TLS rejects, activation-limit failures, cloned client IDs and unusual tenant/application mismatches.
- Rate-limit protocol handshakes at the network edge and enforce connection quotas.
- Add Redis/NATS authenticated pub/sub before horizontally scaling the TCP server.
- Perform dependency scanning, SAST/DAST, container scanning, penetration testing and protocol fuzzing before public deployment.
