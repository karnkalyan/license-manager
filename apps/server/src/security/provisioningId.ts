import { z } from "zod";

const PREFIX = "KTX1.";
const uuid = z.string().uuid();
const moduleSchema = z
  .object({
    code: z.string().regex(/^[A-Z0-9_-]{2,48}$/),
    name: z.string().min(2).max(100),
    description: z.string().max(500).optional(),
    type: z.enum(["boolean", "integer"]).default("boolean"),
    min: z.number().int().min(0).max(1_000_000).optional(),
    max: z.number().int().min(0).max(1_000_000).optional(),
    step: z.number().int().min(1).max(1_000_000).optional(),
    defaultValue: z
      .union([z.boolean(), z.number().int().min(0).max(1_000_000)])
      .optional(),
    unit: z.string().min(1).max(40).optional(),
  })
  .strict();
const payloadSchema = z
  .object({
    v: z.literal(1),
    tenantId: uuid,
    applicationId: uuid,
    clientId: uuid,
    hwid: z.string().regex(/^[a-fA-F0-9]{64}$/),
    modules: z.array(moduleSchema).min(1).max(100),
  })
  .strict();

export type ProvisioningPayload = z.infer<typeof payloadSchema>;

export function decodeProvisioningId(value: string): ProvisioningPayload {
  const normalized = value.trim();
  if (!normalized.startsWith(PREFIX))
    throw new Error("Invalid client provisioning ID");

  try {
    const json = Buffer.from(
      normalized.slice(PREFIX.length),
      "base64url",
    ).toString("utf8");
    const payload = payloadSchema.parse(JSON.parse(json));
    const moduleCodes = payload.modules.map((module) => module.code);
    if (new Set(moduleCodes).size !== moduleCodes.length)
      throw new Error("Duplicate client module codes");
    for (const module of payload.modules) {
      if (
        module.type === "boolean" &&
        module.defaultValue !== undefined &&
        typeof module.defaultValue !== "boolean"
      )
        throw new Error("Invalid boolean capability default");
      if (module.type === "integer") {
        const min = module.min ?? 0;
        const max = module.max ?? 1_000_000;
        if (
          min > max ||
          (module.defaultValue !== undefined &&
            (typeof module.defaultValue !== "number" ||
              module.defaultValue < min ||
              module.defaultValue > max))
        )
          throw new Error("Invalid integer capability bounds");
      }
    }
    return {
      ...payload,
      tenantId: payload.tenantId.toLowerCase(),
      applicationId: payload.applicationId.toLowerCase(),
      hwid: payload.hwid.toLowerCase(),
    };
  } catch {
    throw new Error("Invalid client provisioning ID");
  }
}
