import { readFile } from "node:fs/promises";
import {
  importPKCS8,
  importSPKI,
  jwtVerify,
  SignJWT,
  type JWTPayload,
} from "jose";
import { config } from "../config.js";

let privateKeyPromise: ReturnType<typeof importPKCS8> | undefined;
let publicKeyPromise: ReturnType<typeof importSPKI> | undefined;

async function privateKey() {
  privateKeyPromise ??= readFile(config.LICENSE_PRIVATE_KEY_PATH, "utf8").then(
    (pem) => importPKCS8(pem, "EdDSA"),
  );
  return privateKeyPromise;
}

async function publicKey() {
  publicKeyPromise ??= readFile(config.LICENSE_PUBLIC_KEY_PATH, "utf8").then(
    (pem) => importSPKI(pem, "EdDSA"),
  );
  return publicKeyPromise;
}

export interface LicenseClaims extends JWTPayload {
  jti: string;
  lic: string;
  ten: string;
  app: string;
  prd: string;
  mod: string[];
  ent: Record<string, boolean | number>;
  ev: number;
  hwd?: string;
  typ: "license";
}

export async function signLicenseToken(input: {
  id: string;
  serial: string;
  tenantPublicId: string;
  productPublicId: string;
  productCode: string;
  moduleCodes: string[];
  entitlements: Record<string, boolean | number>;
  entitlementVersion: number;
  hwidHash?: string;
  validFrom: Date;
  expiresAt?: Date | null;
}) {
  let jwt = new SignJWT({
    typ: "license",
    lic: input.serial,
    ten: input.tenantPublicId,
    app: input.productPublicId,
    prd: input.productCode,
    mod: [...new Set(input.moduleCodes)].sort(),
    ent: Object.fromEntries(
      Object.entries(input.entitlements).sort(([a], [b]) => a.localeCompare(b)),
    ),
    ev: input.entitlementVersion,
    ...(input.hwidHash ? { hwd: input.hwidHash } : {}),
  })
    .setProtectedHeader({ alg: "EdDSA", typ: "JWT", kid: "license-ed25519-v1" })
    .setIssuer(config.JWT_ISSUER)
    .setAudience(config.JWT_AUDIENCE)
    .setJti(input.id)
    .setIssuedAt()
    .setNotBefore(Math.floor(input.validFrom.getTime() / 1000));

  if (input.expiresAt)
    jwt = jwt.setExpirationTime(Math.floor(input.expiresAt.getTime() / 1000));
  return jwt.sign(await privateKey());
}

export async function verifyLicenseToken(
  token: string,
): Promise<LicenseClaims> {
  const { payload } = await jwtVerify(token, await publicKey(), {
    algorithms: ["EdDSA"],
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
    typ: "JWT",
  });
  if (
    payload.typ !== "license" ||
    typeof payload.lic !== "string" ||
    typeof payload.prd !== "string" ||
    typeof payload.ten !== "string" ||
    typeof payload.app !== "string" ||
    typeof payload.jti !== "string" ||
    !Array.isArray(payload.mod) ||
    payload.mod.some((x) => typeof x !== "string") ||
    !payload.ent ||
    typeof payload.ent !== "object" ||
    Array.isArray(payload.ent) ||
    Object.values(payload.ent).some(
      (x) =>
        typeof x !== "boolean" &&
        !(typeof x === "number" && Number.isInteger(x) && x >= 0),
    ) ||
    typeof payload.ev !== "number" ||
    !Number.isInteger(payload.ev)
  )
    throw new Error("Invalid license token claims");
  return payload as LicenseClaims;
}

export async function signStateEvent(input: {
  clientId: string;
  licenseId: string;
  tenantPublicId: string;
  productPublicId: string;
  event: string;
  sequence: number;
  entitlementVersion?: number;
  modules?: string[];
  entitlements?: Record<string, boolean | number>;
  reason?: string | null;
}) {
  return new SignJWT({
    typ: "license-state",
    cid: input.clientId,
    lid: input.licenseId,
    ten: input.tenantPublicId,
    app: input.productPublicId,
    evt: input.event,
    seq: input.sequence,
    ...(typeof input.entitlementVersion === "number"
      ? { ev: input.entitlementVersion }
      : {}),
    ...(input.modules ? { mod: [...new Set(input.modules)].sort() } : {}),
    ...(input.entitlements
      ? {
          ent: Object.fromEntries(
            Object.entries(input.entitlements).sort(([a], [b]) =>
              a.localeCompare(b),
            ),
          ),
        }
      : {}),
    ...(input.reason ? { reason: input.reason } : {}),
  })
    .setProtectedHeader({ alg: "EdDSA", typ: "JWT", kid: "license-ed25519-v1" })
    .setIssuer(config.JWT_ISSUER)
    .setAudience(config.JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("2m")
    .sign(await privateKey());
}
