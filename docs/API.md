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

---

# External Licensing API (v1)

Base URL: `http://localhost:8081/api/v1`

Used by external client portals, billing microservices, e-commerce webhooks, and automation bots.
Authenticated via duration-based API keys with origin domain whitelisting.

### Authentication Headers
- `X-API-Key: KTX_YOUR_KEY_HERE` (or `Authorization: Bearer KTX_YOUR_KEY_HERE`)
- `Origin: https://your-authorized-domain.com` (required when domain restrictions are enabled)

---

### 1. Key Status & Enclave Health
- `GET /api/v1/status`

**Example Request:**
```bash
curl -X GET "http://localhost:8081/api/v1/status" \
  -H "X-API-Key: KTX_YOUR_KEY_HERE" \
  -H "Origin: https://your-domain.com"
```

**Example Response (200 OK):**
```json
{
  "ok": true,
  "keyName": "Billing Microservice Key",
  "role": "READ_EXTEND",
  "allowedDomains": "billing.corp.com,*.corp.com",
  "expiresAt": "2027-10-22T00:00:00.000Z",
  "remainingDays": 365
}
```

---

### 2. Review & Filter Licenses
- `GET /api/v1/licenses?status=ACTIVE&q=Acme`

**Query Parameters:**
- `q`: Search query across serial, customer tenant, customer contact, vendor name, or product name.
- `status`: `ACTIVE`, `SUSPENDED`, `REVOKED`, `EXPIRED`.
- `application`: Product code or application public UUID.

**Example Request:**
```bash
curl -X GET "http://localhost:8081/api/v1/licenses?status=ACTIVE" \
  -H "X-API-Key: KTX_YOUR_KEY_HERE" \
  -H "Origin: https://your-domain.com"
```

**Example Response (200 OK):**
```json
{
  "total": 1,
  "licenses": [
    {
      "serial": "LIC-KTX94812-7F3A",
      "status": "ACTIVE",
      "customerOrganization": "Acme Industrial Technologies",
      "customerContact": {
        "name": "Sarah Jenkins",
        "email": "sarah.jenkins@acmeindustrial.com"
      },
      "vendor": {
        "id": "cm12v48a",
        "name": "Kashtrix Deep Enclave",
        "code": "KTX_CORE",
        "publicId": "4a29a08e-8cf4-4b92-802c-7b4bf4349cb6"
      },
      "application": {
        "id": "cm12w99z",
        "name": "StreamOps Gateway Engine",
        "code": "STREAMOPS_V2",
        "publicId": "b810d7a4-8461-469b-980b-d5a2d67d1d29"
      },
      "seats": {
        "maxActivations": 5,
        "activeActivations": 1
      },
      "dates": {
        "validFrom": "2026-01-01T00:00:00.000Z",
        "expiresAt": "2027-01-01T00:00:00.000Z"
      },
      "modules": [
        { "code": "CORE", "name": "Core Engine" }
      ],
      "entitlements": {
        "maxThroughputGbps": 100
      },
      "activations": [
        {
          "clientId": "c-node-prod-01",
          "platform": "linux",
          "appVersion": "2.4.0",
          "isSocketOnline": true
        }
      ]
    }
  ]
}
```

---

### 3. Inspect Specific License
- `GET /api/v1/licenses/:serial`

**Example Request:**
```bash
curl -X GET "http://localhost:8081/api/v1/licenses/LIC-KTX94812-7F3A" \
  -H "X-API-Key: KTX_YOUR_KEY_HERE" \
  -H "Origin: https://your-domain.com"
```

---

### 4. Extend License Duration
- `POST /api/v1/licenses/:serial/extend`

Extends the validity period of an active or expired license, re-issues the cryptographic token, and immediately pushes the update over live mTLS socket connections to connected software instances.

**Example Request (By Days):**
```bash
curl -X POST "http://localhost:8081/api/v1/licenses/LIC-KTX94812-7F3A/extend" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: KTX_YOUR_KEY_HERE" \
  -H "Origin: https://your-domain.com" \
  -d '{
    "days": 90,
    "reason": "Quarterly subscription renewal invoice #9921"
  }'
```

**Example Request (By Specific Date):**
```bash
curl -X POST "http://localhost:8081/api/v1/licenses/LIC-KTX94812-7F3A/extend" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: KTX_YOUR_KEY_HERE" \
  -H "Origin: https://your-domain.com" \
  -d '{
    "expiresAt": "2028-01-01T00:00:00.000Z",
    "reason": "Enterprise multi-year contract renewal"
  }'
```

**Example Response (200 OK):**
```json
{
  "ok": true,
  "serial": "LIC-KTX94812-7F3A",
  "status": "ACTIVE",
  "expiresAt": "2027-04-01T00:00:00.000Z",
  "previousExpiresAt": "2027-01-01T00:00:00.000Z",
  "entitlementVersion": 4,
  "jwtKey": "eyJhbGciOiJFZERTQTEyOCIsInR5cCI6IkpXVCJ9...",
  "message": "License successfully extended until 2027-04-01T00:00:00.000Z"
}
```
