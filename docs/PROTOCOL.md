# Omni License Protocol v2

Protocol v2 uses one bidirectional **TLS 1.3** connection per running licensed application instance. Production deployments should require mTLS. The channel performs activation, continuous online validation, entitlement retrieval, heartbeat, and signed server-to-client license-state events. It is intentionally **not** a remote shell or arbitrary command channel.

Messages are UTF-8 newline-delimited JSON (NDJSON), maximum 64 KiB per frame.

## HELLO

Immediately after TLS authentication:

```json
{
  "type": "HELLO",
  "protocol": 2,
  "clientId": "persistent-random-installation-uuid",
  "licenseKey": "<JWT>",
  "tenantId": "tenant-public-uuid",
  "applicationId": "application-public-uuid",
  "hwid": "<64-char-application-scoped-sha256>",
  "appVersion": "2.4.0",
  "platform": "windows-x64"
}
```

The server rejects the connection unless all four scopes agree:

1. JWT `ten` claim equals the presented tenant UUID.
2. JWT `app` claim equals the presented application UUID.
3. Database license belongs to the same tenant/application.
4. HWID is the v2 fingerprint scoped to that tenant/application.

A valid key for one application therefore cannot be replayed by a different application on the same machine.

## WELCOME

```json
{
  "type": "WELCOME",
  "clientId": "...",
  "licenseId": "...",
  "state": "LICENSED",
  "tenantId": "...",
  "applicationId": "...",
  "modules": ["CORE", "REPORTING"],
  "entitlementVersion": 1,
  "heartbeatSeconds": 30,
  "serverTime": 1760000000000
}
```

`modules` is the authoritative feature set for the validated key. An application should enable gated functionality only after WELCOME has been accepted.

## HEARTBEAT

```json
{"type":"HEARTBEAT","ts":1760000000000,"nonce":"random-uuid"}
```

Response:

```json
{"type":"HEARTBEAT_ACK","serverTime":1760000000000,"nonce":"same-nonce","entitlementVersion":1}
```

The default interval is 30 seconds; the server destroys stale sessions after 90 seconds. The reference SDK also uses a fail-closed acknowledgement watchdog.

## ENTITLEMENTS_REQUEST

A running application can refresh its module list through the existing channel:

```json
{"type":"ENTITLEMENTS_REQUEST","nonce":"random-uuid"}
```

Response:

```json
{
  "type":"ENTITLEMENTS",
  "nonce":"same-nonce",
  "modules":["CORE","REPORTING"],
  "entitlementVersion":1,
  "signedEvent":"<Ed25519 signed short-lived JWT>"
}
```

The client must verify that the signed snapshot matches the tenant UUID, application UUID, license ID, client ID, module list, entitlement version, issuer/audience, expiry, and monotonic sequence before applying it.

## LICENSE_EVENT

```json
{"type":"LICENSE_EVENT","event":"LICENSE_REVOKED","signedEvent":"<signed JWT>"}
```

Supported operational events include:

- `LICENSE_REVOKED`
- `LICENSE_SUSPENDED`
- `LICENSE_EXPIRED`
- `LICENSE_RESTORED`
- `CLIENT_BANNED`
- `TENANT_SUSPENDED`
- `REVALIDATE_NOW`
- `LICENSE_KEY_REISSUED`

State events contain tenant/application scope, license ID, client ID, sequence, module snapshot/entitlement version when available, short expiration, and an Ed25519 signature.

## Module changes and key reissue

The module list is signed into the license JWT. Changing a license's selected modules increments `entitlementVersion` and returns a **replacement JWT**. The previous JWT hash is replaced in MySQL, so the old key is rejected on reconnect. Connected clients receive `LICENSE_KEY_REISSUED`; administrators must securely deliver/persist the replacement key in the licensed application.
