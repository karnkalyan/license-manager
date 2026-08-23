import assert from "node:assert/strict";
import test from "node:test";
import { validateClientEntitlements } from "./entitlementService.js";

const payload = {
  v: 1 as const,
  tenantId: "11111111-1111-4111-8111-111111111111",
  applicationId: "22222222-2222-4222-8222-222222222222",
  clientId: "33333333-3333-4333-8333-333333333333",
  hwid: "a".repeat(64),
  modules: [
    { code: "VOD_PLAYOUT", name: "VOD Playout", type: "boolean" as const },
    {
      code: "RECORDING_DEVICES",
      name: "Recording devices",
      type: "integer" as const,
      min: 0,
      max: 1_000_000,
      step: 1,
      unit: "devices",
    },
    {
      code: "CUSTOM_CLIENT_LIMIT",
      name: "Custom client limit",
      type: "integer" as const,
      min: 3,
      max: 99,
      step: 2,
    },
  ],
};

test("accepts arbitrary client-declared boolean and integer entitlements", () => {
  assert.deepEqual(
    validateClientEntitlements(payload, {
      VOD_PLAYOUT: true,
      RECORDING_DEVICES: 5,
      CUSTOM_CLIENT_LIMIT: 17,
    }),
    {
      CUSTOM_CLIENT_LIMIT: 17,
      RECORDING_DEVICES: 5,
      VOD_PLAYOUT: true,
    },
  );
});

test("rejects server-unknown fields and values outside client bounds", () => {
  assert.throws(
    () => validateClientEntitlements(payload, { SERVER_HARDCODED_FIELD: 1 }),
    /not advertised/,
  );
  assert.throws(
    () => validateClientEntitlements(payload, { CUSTOM_CLIENT_LIMIT: 18 }),
    /steps of 2/,
  );
});
