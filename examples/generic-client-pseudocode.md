# Generic application integration pseudocode

```text
TENANT_ID = public_uuid_copied_from_admin
APPLICATION_ID = public_uuid_copied_from_admin

client_id = load_or_create_random_installation_uuid_scoped_to(TENANT_ID, APPLICATION_ID)
hwid = generate_application_scoped_hwid(TENANT_ID, APPLICATION_ID)
license_key = read_from_os_protected_storage()

socket = TLS13_CONNECT(
  license_server,
  validate_server_certificate = true,
  client_certificate = unique_installation_certificate
)

SEND_NDJSON(socket, {
  type: "HELLO",
  protocol: 2,
  clientId: client_id,
  licenseKey: license_key,
  tenantId: TENANT_ID,
  applicationId: APPLICATION_ID,
  hwid: hwid,
  appVersion: APP_VERSION,
  platform: PLATFORM
})

message = RECEIVE_NDJSON_WITH_TIMEOUT(socket, 15 seconds)
IF message.type != "WELCOME":
    DISABLE_LICENSED_FEATURES()

VERIFY message.tenantId == TENANT_ID
VERIFY message.applicationId == APPLICATION_ID
licensed_modules = message.modules

FUNCTION has_module(code):
    RETURN connection_is_currently_licensed AND code IN licensed_modules

FUNCTION require_module(code):
    IF NOT has_module(code): DENY_FEATURE()

EVERY message.heartbeatSeconds:
    nonce = RANDOM_UUID()
    SEND_NDJSON(socket, { type: "HEARTBEAT", ts: UNIX_MS(), nonce: nonce })

IF socket closes OR no HEARTBEAT_ACK before local validation deadline:
    DISABLE_LICENSED_FEATURES()   // always-online fail closed
    CLOSE(socket)

TO REFRESH MODULES:
    nonce = RANDOM_UUID()
    SEND_NDJSON(socket, { type: "ENTITLEMENTS_REQUEST", nonce: nonce })
    response = RECEIVE_ENTITLEMENTS(nonce)
    VERIFY Ed25519 signedEvent
    VERIFY issuer, audience, expiry, clientId, licenseId, tenantId, applicationId,
           module list, entitlementVersion and monotonically increasing sequence
    licensed_modules = response.modules

ON LICENSE_EVENT:
    VERIFY Ed25519 signedEvent with public manager key
    VERIFY issuer, audience, expiry, clientId, licenseId, tenantId, applicationId,
           event name and monotonically increasing sequence
    IF event is LICENSE_REVOKED, LICENSE_SUSPENDED, LICENSE_EXPIRED,
       CLIENT_BANNED or TENANT_SUSPENDED:
        DISABLE_LICENSED_FEATURES()
        CLOSE(socket)
```

Do not add generic command execution to this channel. Implement only the documented license and entitlement messages.
