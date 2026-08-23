import type { ProvisioningPayload } from "../security/provisioningId.js";

export type EntitlementValue = boolean | number;
export type EntitlementMap = Record<string, EntitlementValue>;

export function normalizeEntitlements(value: unknown): EntitlementMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const normalized: EntitlementMap = {};
  for (const [rawCode, rawValue] of Object.entries(value)) {
    const code = rawCode.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,48}$/.test(code)) continue;
    if (typeof rawValue === "boolean") normalized[code] = rawValue;
    else if (
      typeof rawValue === "number" &&
      Number.isInteger(rawValue) &&
      rawValue >= 0 &&
      rawValue <= 1_000_000
    )
      normalized[code] = rawValue;
  }
  return Object.fromEntries(
    Object.entries(normalized).sort(([a], [b]) => a.localeCompare(b)),
  );
}

export function validateClientEntitlements(
  payload: ProvisioningPayload,
  value: unknown,
): EntitlementMap {
  const requested = normalizeEntitlements(value);
  const definitions = new Map(
    payload.modules.map((capability) => [capability.code, capability]),
  );
  for (const code of Object.keys(requested))
    if (!definitions.has(code))
      throw new Error(
        `Entitlement ${code} was not advertised by this client application`,
      );

  const result: EntitlementMap = {};
  for (const capability of payload.modules) {
    const supplied = requested[capability.code];
    if (capability.type === "boolean") {
      if (supplied !== undefined && typeof supplied !== "boolean")
        throw new Error(`${capability.name} must be enabled or disabled`);
      result[capability.code] =
        supplied ??
        (typeof capability.defaultValue === "boolean"
          ? capability.defaultValue
          : false);
      continue;
    }
    if (
      supplied !== undefined &&
      (typeof supplied !== "number" || !Number.isInteger(supplied))
    )
      throw new Error(`${capability.name} must be a whole number`);
    const selected =
      typeof supplied === "number"
        ? supplied
        : typeof capability.defaultValue === "number"
          ? capability.defaultValue
          : (capability.min ?? 0);
    const min = capability.min ?? 0;
    const max = capability.max ?? 1_000_000;
    const step = capability.step ?? 1;
    if (selected < min || selected > max || (selected - min) % step !== 0)
      throw new Error(
        `${capability.name} must be between ${min} and ${max} in steps of ${step}`,
      );
    result[capability.code] = selected;
  }
  return normalizeEntitlements(result);
}

export function enabledCodes(entitlements: EntitlementMap): string[] {
  return Object.entries(entitlements)
    .filter(
      ([, value]) => value === true || (typeof value === "number" && value > 0),
    )
    .map(([code]) => code)
    .sort();
}

export function entitlementsFromMetadata(
  metadata: unknown,
  moduleCodes: string[] = [],
): EntitlementMap {
  const record =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const stored = normalizeEntitlements(record.entitlements);
  if (Object.keys(stored).length) return stored;
  return normalizeEntitlements(
    Object.fromEntries(moduleCodes.map((code) => [code, true])),
  );
}
