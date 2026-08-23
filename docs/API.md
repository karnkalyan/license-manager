# Admin REST API

Base URL: `http://localhost:8081/api`

The browser admin uses a short-lived HttpOnly, SameSite session cookie with origin checks. All mutation endpoints require authenticated RBAC permissions.

## Authentication

- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/change-password`
- `POST /auth/logout`

## Vendors / tenants

- `GET /tenants`
- `POST /tenants`

```json
{"code":"VENDOR_A","name":"Vendor A","description":"optional"}
```

Each tenant receives an immutable public UUID used as the protocol namespace.

- `POST /tenants/:id/status`

```json
{"status":"SUSPENDED"}
```

A suspended tenant causes all of its online licensing checks to fail closed.

## Applications

Both `/applications` and the backward-compatible `/products` path address the application resource.

- `GET /applications`
- `POST /applications`

```json
{
  "tenantId":"database-tenant-id",
  "code":"DESKTOP_PRO",
  "name":"Desktop Pro",
  "description":"optional"
}
```

Each application receives a different public UUID even if two tenants use the same code/name.

## Modules

- `POST /applications/:applicationDatabaseId/modules`

```json
{"code":"REPORTING","name":"Reporting","description":"optional"}
```

- `PATCH /applications/:applicationDatabaseId/modules/:moduleId`

```json
{"enabled":false}
```

A module that is still assigned to any license cannot be disabled; the API returns `409` until those licenses are reissued without that module.

## Licenses

- `GET /licenses?q=...`
- `POST /licenses`

```json
{
  "productId":"application-database-id",
  "moduleIds":["module-db-id-1","module-db-id-2"],
  "customerRef":"customer-123",
  "hwid":"optional-application-scoped-sha256-hwid",
  "expiresAt":"2027-08-21T00:00:00.000Z",
  "maxActivations":1,
  "metadata":{"edition":"pro"}
}
```

The plaintext JWT key is returned once and is not stored. MySQL stores the token SHA-256 hash.

- `POST /licenses/:id/modules`

```json
{"moduleIds":["module-db-id-1"]}
```

This reissues the JWT, increments `entitlementVersion`, invalidates the previous token hash, and returns the replacement key once.

- `POST /licenses/:id/status`

```json
{"status":"REVOKED","reason":"Reported stolen"}
```

Valid states are `ACTIVE`, `SUSPENDED`, and `REVOKED`.

## Clients

- `GET /clients`
- `POST /clients/:clientId/revalidate`
- `POST /clients/:clientId/ban`
- `POST /clients/:clientId/unban`

A client ban affects only that installation. License revocation affects all activations of the license. Tenant suspension affects every application/license below that tenant.

## Dashboard and audit

- `GET /dashboard`
- `GET /audit`
