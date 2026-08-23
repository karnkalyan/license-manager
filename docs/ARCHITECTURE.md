# Architecture and Implementation Plan

## Security boundaries

```text
Vendor / Tenant (public UUID)
  └─ Application (different public UUID per tenant/application)
      ├─ Module CORE
      ├─ Module REPORTING
      └─ Module AUTOMATION
           └─ License (unique Ed25519 JWT + selected module set)
                └─ Activation (random client UUID + app-scoped HWID + mTLS fingerprint)
```

The same physical computer does not have one global License Manager HWID. It has a separate derived HWID for each `(tenant UUID, application UUID)` namespace. This intentionally prevents license reuse and cross-application correlation.

## Components

```text
React Admin Panel --HTTPS--> Node.js Admin API --Prisma--> MySQL
                                      |
                                      +--- authoritative tenant/app/module/license state
                                      |
Licensed application <--TLS 1.3/mTLS--> Node.js License TCP Server :7443
     |                                      |
     +-- LicenseSystem SDK                  +-- signed validation/events
     +-- app-scoped HWID                    +-- in-memory live socket registry
     +-- module gates
```

## License JWT v2

Representative claims:

```json
{
  "typ":"license",
  "jti":"license-id",
  "lic":"LIC-...",
  "ten":"tenant-public-uuid",
  "app":"application-public-uuid",
  "prd":"OMNI_APP",
  "mod":["CORE","REPORTING"],
  "ev":1,
  "hwd":"optional-server-hmac-hwid",
  "iss":"secure-license-manager",
  "aud":"licensed-app"
}
```

The JWT proves issuance and immutable scope. MySQL remains authoritative for revocation, suspension, current entitlement version, activation count, bans, and expiry.

## Multi-tenant isolation rules

- Product/application code is unique **inside a tenant**, not globally.
- Public tenant UUID and application UUID are globally unique.
- Every HELLO contains both UUIDs.
- The JWT contains both UUIDs.
- The database relationship is checked again server-side.
- Application-scoped HWID includes both UUIDs.
- A persistent random client ID is checked against its existing license/HWID/application binding.
- An mTLS certificate fingerprint can be bound to the activation.

These checks are intentionally redundant so one compromised layer does not silently turn into cross-tenant license acceptance.

## Modules

Modules are application-owned feature identifiers. A license selects zero or more enabled modules through `LicenseModule`. The authorized codes are signed into the JWT and returned in WELCOME and signed entitlement snapshots. Applications gate functionality with `hasModule()` / `requireModule()` rather than parsing the JWT themselves.

## Horizontal scaling

The included live-client registry is in-memory and therefore single-node for immediate push delivery. MySQL remains authoritative, so reconnect validation is safe. For multiple TCP nodes, use authenticated pub/sub (for example Redis or NATS) to route a ban/revoke/revalidation event to the process owning the socket, and use sticky/consistent routing where appropriate.
