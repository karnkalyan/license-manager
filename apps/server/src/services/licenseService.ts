import { createHash, randomBytes, randomUUID } from "node:crypto";
import { prisma } from "../db.js";
import { LicenseStatus, TenantStatus } from "../generated/prisma/enums.js";
import { safeHashEqual, serverHwidHash } from "../security/hwid.js";
import {
  signLicenseToken,
  verifyLicenseToken,
} from "../security/licenseJwt.js";
import {
  entitlementsFromMetadata,
  normalizeEntitlements,
  type EntitlementMap,
} from "./entitlementService.js";

function serial() {
  return `LIC-${randomBytes(5).toString("hex").toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

async function loadApplication(productId: string) {
  return prisma.product.findUniqueOrThrow({
    where: { id: productId },
    include: {
      tenant: true,
      modules: { where: { enabled: true }, orderBy: { code: "asc" } },
    },
  });
}

async function resolveModules(productId: string, moduleIds: string[]) {
  if (!moduleIds.length) return [];
  const unique = [...new Set(moduleIds)];
  const modules = await prisma.module.findMany({
    where: { id: { in: unique }, productId, enabled: true },
    orderBy: { code: "asc" },
  });
  if (modules.length !== unique.length)
    throw new Error(
      "One or more modules do not belong to the selected application or are disabled",
    );
  return modules;
}

export async function createLicense(input: {
  productId: string;
  moduleIds: string[];
  customerRef?: string;
  hwid?: string;
  expiresAt?: Date | null;
  maxActivations?: number;
  metadata?: Record<string, unknown>;
  entitlements?: EntitlementMap;
}) {
  const product = await loadApplication(input.productId);
  if (product.tenant.status !== TenantStatus.ACTIVE)
    throw new Error("Vendor/tenant is suspended");
  const entitlements = normalizeEntitlements(input.entitlements);
  const modules = await resolveModules(product.id, input.moduleIds);
  const id = randomUUID();
  const hwidHash = input.hwid ? serverHwidHash(input.hwid, id) : undefined;
  const licSerial = serial();
  const validFrom = new Date();
  const entitlementVersion = 1;
  const jwtKey = await signLicenseToken({
    id,
    serial: licSerial,
    tenantPublicId: product.tenant.publicId,
    productPublicId: product.publicId,
    productCode: product.code,
    moduleCodes: modules.map((m) => m.code),
    entitlementVersion,
    entitlements,
    hwidHash,
    validFrom,
    expiresAt: input.expiresAt,
  });
  const tokenHash = createHash("sha256").update(jwtKey).digest("hex");
  const record = await prisma.license.create({
    data: {
      id,
      serial: licSerial,
      customerRef: input.customerRef,
      productId: product.id,
      hwidHash,
      tokenHash,
      maxActivations: input.maxActivations ?? 1,
      validFrom,
      expiresAt: input.expiresAt,
      metadata: { ...(input.metadata || {}), entitlements } as any,
      entitlementVersion,
      modules: { create: modules.map((module) => ({ moduleId: module.id })) },
    },
    include: {
      product: { include: { tenant: true } },
      modules: { include: { module: true } },
      activations: true,
    },
  });
  return { ...record, jwtKey };
}

export async function reissueLicenseModules(
  licenseId: string,
  moduleIds: string[],
  details: {
    customerName?: string;
    customerEmail?: string;
    expiresAt?: Date;
    entitlements?: EntitlementMap;
    provisioningId?: string;
  } = {},
) {
  const current = await prisma.license.findUniqueOrThrow({
    where: { id: licenseId },
    include: { product: { include: { tenant: true } } },
  });
  const modules = await resolveModules(current.productId, moduleIds);
  const entitlementVersion = current.entitlementVersion + 1;
  const expiresAt = details.expiresAt ?? current.expiresAt;
  const currentMetadata =
    current.metadata &&
    typeof current.metadata === "object" &&
    !Array.isArray(current.metadata)
      ? (current.metadata as Record<string, unknown>)
      : {};
  const entitlements = details.entitlements
    ? normalizeEntitlements(details.entitlements)
    : entitlementsFromMetadata(
        current.metadata,
        modules.map((module) => module.code),
      );
  const metadata = {
    ...currentMetadata,
    ...(details.provisioningId ? { provisioningId: details.provisioningId } : {}),
    ...(details.customerName ? { customerName: details.customerName } : {}),
    ...(details.customerEmail ? { customerEmail: details.customerEmail } : {}),
    entitlements,
  };
  const jwtKey = await signLicenseToken({
    id: current.id,
    serial: current.serial,
    tenantPublicId: current.product.tenant.publicId,
    productPublicId: current.product.publicId,
    productCode: current.product.code,
    moduleCodes: modules.map((m) => m.code),
    entitlementVersion,
    entitlements,
    hwidHash: current.hwidHash ?? undefined,
    validFrom: current.validFrom,
    expiresAt,
  });
  const tokenHash = createHash("sha256").update(jwtKey).digest("hex");
  const updated = await prisma.$transaction(async (tx) => {
    await tx.licenseModule.deleteMany({ where: { licenseId } });
    return tx.license.update({
      where: { id: licenseId },
      data: {
        entitlementVersion,
        tokenHash,
        expiresAt,
        metadata: metadata as any,
        ...(details.customerName ? { customerRef: details.customerName } : {}),
        modules: { create: modules.map((module) => ({ moduleId: module.id })) },
      },
      include: {
        product: { include: { tenant: true } },
        modules: { include: { module: true } },
        activations: true,
      },
    });
  });
  return { ...updated, jwtKey };
}

export async function reissueCurrentLicense(licenseId: string) {
  const current = await prisma.license.findUniqueOrThrow({
    where: { id: licenseId },
    include: { modules: true },
  });
  return reissueLicenseModules(
    licenseId,
    current.modules.map((item) => item.moduleId),
  );
}

export async function findActiveLicenseForInstallation(
  productId: string,
  clientId: string,
  hwid: string,
) {
  const now = new Date();
  const [activation, candidates] = await Promise.all([
    prisma.activation.findUnique({
      where: { clientId },
      select: { licenseId: true },
    }),
    prisma.license.findMany({
      where: {
        productId,
        status: LicenseStatus.ACTIVE,
        validFrom: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { id: true, hwidHash: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);
  const matching = candidates.filter(
    (license) =>
      license.hwidHash &&
      safeHashEqual(license.hwidHash, serverHwidHash(hwid, license.id)),
  );
  return (
    matching.find((license) => license.id === activation?.licenseId) ??
    matching[0] ??
    null
  );
}

export async function validatePresentedLicense(
  token: string,
  clientHwid: string,
  tenantPublicId: string,
  productPublicId: string,
) {
  const claims = await verifyLicenseToken(token);
  if (claims.ten !== tenantPublicId || claims.app !== productPublicId)
    throw new Error("License does not belong to this vendor/application");

  const lic = await prisma.license.findUnique({
    where: { id: claims.jti },
    include: {
      product: { include: { tenant: true } },
      activations: true,
      modules: { include: { module: true } },
    },
  });
  const tokenHash = createHash("sha256").update(token).digest("hex");
  if (!lic || !safeHashEqual(lic.tokenHash, tokenHash))
    throw new Error("License not found or key has been superseded");
  if (
    lic.product.publicId !== productPublicId ||
    lic.product.tenant.publicId !== tenantPublicId
  )
    throw new Error("Application namespace mismatch");
  if (lic.product.tenant.status !== TenantStatus.ACTIVE)
    throw new Error("Vendor/tenant suspended");
  if (lic.status !== LicenseStatus.ACTIVE)
    throw new Error(`License ${lic.status.toLowerCase()}`);
  if (lic.expiresAt && lic.expiresAt <= new Date())
    throw new Error("License expired");
  if (claims.ev !== lic.entitlementVersion)
    throw new Error("License key has been superseded");

  const dbModules = lic.modules
    .map((x) => x.module)
    .filter((m) => m.enabled)
    .map((m) => m.code)
    .sort();
  const dbEntitlements = entitlementsFromMetadata(lic.metadata, dbModules);
  const claimModules = [...claims.mod].sort();
  if (JSON.stringify(dbModules) !== JSON.stringify(claimModules))
    throw new Error(
      "License module entitlement has changed; use the reissued key",
    );
  if (
    JSON.stringify(dbEntitlements) !==
    JSON.stringify(normalizeEntitlements(claims.ent))
  )
    throw new Error(
      "License entitlement values have changed; use the reissued key",
    );

  const hwidHash = serverHwidHash(clientHwid, claims.jti);
  if (lic.hwidHash && lic.hwidHash !== hwidHash)
    throw new Error("HWID mismatch");
  if (claims.hwd && claims.hwd !== hwidHash)
    throw new Error("Signed HWID mismatch");
  return {
    lic,
    hwidHash,
    claims,
    modules: dbModules,
    entitlements: dbEntitlements,
  };
}
