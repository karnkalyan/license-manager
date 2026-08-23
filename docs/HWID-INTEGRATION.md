# Application-Scoped HWID Integration

## Security objective

The hardware identifier is a **binding signal**, not a password. Raw motherboard UUIDs, machine IDs, serial numbers, MAC addresses, and other hardware identifiers must never be sent to the License Manager.

Protocol v2 deliberately scopes the client HWID to both the **vendor/tenant UUID** and the **application UUID**. Therefore:

- same machine + same vendor + same application => stable same HWID;
- same machine + different application => different HWID;
- same machine + same application name/code under another vendor => different HWID;
- MySQL stores neither the raw machine identifier nor the client-scoped HWID.

## Canonical algorithm

First create an internal base fingerprint that is never transmitted:

```text
components = [stable_os_machine_id, platform, cpu_arch]
canonical = SORT(LOWERCASE(TRIM(components))).JOIN("|")
base_hardware_fingerprint = HEX(SHA256("lm-base-hwid-v2|" + canonical))
```

Then derive the application-scoped value:

```text
app_hwid = HEX(SHA256(
  "lm-app-hwid-v2|" +
  LOWERCASE(tenant_public_uuid) + "|" +
  LOWERCASE(application_public_uuid) + "|" +
  base_hardware_fingerprint
))
```

Only `app_hwid` is transmitted.

The server applies a second, secret HMAC layer before storage:

```text
stored_hwid = HEX(HMAC_SHA256(
  HWID_PEPPER,
  "lm-server-hwid-v2|" + license_id + "|" + app_hwid
))
```

This creates three privacy/security boundaries: raw machine identifiers remain local; different applications cannot correlate the same computer by HWID; and a database leak does not expose the client-scoped HWID.

## Stable OS machine component

- Windows: `Win32_ComputerSystemProduct.UUID`
- Linux: `/etc/machine-id`, fallback `/var/lib/dbus/machine-id`
- macOS: `IOPlatformUUID` from `IOPlatformExpertDevice`

Reject all-zero/all-`F` firmware placeholders. Do not use hostname or IP address as the primary identity.

## Node.js SDK

```ts
import { generateHwid } from '@license/node-sdk';

const hwid = await generateHwid({
  tenantId: 'tenant-public-uuid',
  applicationId: 'application-public-uuid'
});
```

## C# derivation

```csharp
static string Sha256Hex(string value) =>
    Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)))
        .ToLowerInvariant();

var normalizedComponents = components
    .Select(x => x.Trim().ToLowerInvariant())
    .OrderBy(x => x, StringComparer.Ordinal);
var canonical = string.Join("|", normalizedComponents);
var baseFingerprint = Sha256Hex("lm-base-hwid-v2|" + canonical);
var appHwid = Sha256Hex(
    $"lm-app-hwid-v2|{tenantId.ToLowerInvariant()}|{applicationId.ToLowerInvariant()}|{baseFingerprint}");
```

## Python derivation

```python
import hashlib

def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()

canonical = "|".join(sorted(x.strip().lower() for x in components))
base_fingerprint = sha256_hex("lm-base-hwid-v2|" + canonical)
app_hwid = sha256_hex(
    f"lm-app-hwid-v2|{tenant_id.lower()}|{application_id.lower()}|{base_fingerprint}"
)
```

## Installation ID

The HWID and installation/client ID solve different problems. Each application installation must also persist a random UUID. The Node helper creates an application-scoped storage filename:

```ts
const clientId = await loadOrCreateScopedClientId(
  appDataDirectory,
  TENANT_ID,
  APPLICATION_ID
);
```

Do not derive `clientId` from the HWID. A random persisted installation ID makes clone/reset workflows auditable and prevents one identifier from being overloaded for multiple security purposes.
