import { readFileSync } from "node:fs";
import { createServer, type TLSSocket } from "node:tls";
import { config } from "../config.js";
import { prisma } from "../db.js";
import {
  ClientState,
  LicenseStatus,
  AuditSeverity,
  TenantStatus,
} from "../generated/prisma/enums.js";
import {
  findActiveLicenseForInstallation,
  reissueCurrentLicense,
  validatePresentedLicense,
} from "../services/licenseService.js";
import { signStateEvent } from "../security/licenseJwt.js";
import { decodeProvisioningId } from "../security/provisioningId.js";
import { safeHashEqual, serverHwidHash } from "../security/hwid.js";
import {
  entitlementRequestSchema,
  heartbeatSchema,
  helloSchema,
  provisionHeartbeatSchema,
  provisionSchema,
  writeMessage,
} from "./protocol.js";
import { provisioningRegistry, registry } from "./registry.js";
import { entitlementsFromMetadata } from "../services/entitlementService.js";

const MAX_LINE = 64 * 1024;
const HEARTBEAT_SECONDS = 30;
const STALE_MS = 90_000;

function customerDetails(license: {
  customerRef: string | null;
  metadata: unknown;
}) {
  const metadata =
    license.metadata &&
    typeof license.metadata === "object" &&
    !Array.isArray(license.metadata)
      ? (license.metadata as Record<string, unknown>)
      : {};
  return {
    customerName:
      typeof metadata.customerName === "string" && metadata.customerName.trim()
        ? metadata.customerName.trim()
        : license.customerRef || undefined,
    customerEmail:
      typeof metadata.customerEmail === "string" &&
      metadata.customerEmail.trim()
        ? metadata.customerEmail.trim()
        : undefined,
  };
}

async function disconnectClient(clientId: string, socket: TLSSocket) {
  const current = registry.get(clientId);
  if (!current || current.socket !== socket) return;
  registry.delete(clientId);
  await prisma.activation.updateMany({
    where: { clientId, state: { not: ClientState.BANNED } },
    data: { state: ClientState.OFFLINE, disconnectedAt: new Date() },
  });
}

async function currentEntitlements(licenseId: string) {
  const lic = await prisma.license.findUniqueOrThrow({
    where: { id: licenseId },
    include: {
      product: { include: { tenant: true } },
      modules: { include: { module: true } },
    },
  });
  return {
    lic,
    modules: lic.modules
      .map((x) => x.module)
      .filter((m) => m.enabled)
      .map((m) => m.code)
      .sort(),
    entitlements: entitlementsFromMetadata(
      lic.metadata,
      lic.modules.map((x) => x.module.code),
    ),
  };
}

async function handleHello(socket: TLSSocket, raw: unknown) {
  const hello = helloSchema.parse(raw);
  const { lic, hwidHash, modules, entitlements } =
    await validatePresentedLicense(
      hello.licenseKey,
      hello.hwid,
      hello.tenantId,
      hello.applicationId,
    );
  const peer = socket.getPeerCertificate();
  const tlsCertFingerprint =
    peer && typeof peer.fingerprint256 === "string"
      ? peer.fingerprint256
      : undefined;
  if (config.TLS_REQUIRE_CLIENT_CERT && !tlsCertFingerprint)
    throw new Error("Client certificate required");

  const activation = await prisma.$transaction(
    async (tx) => {
      // Lock the authoritative license row for this transaction so concurrent
      // clients cannot race the activation-count check. MySQL releases this
      // row lock automatically when the serializable transaction completes.
      await tx.$queryRaw`SELECT id FROM \`License\` WHERE id = ${lic.id} FOR UPDATE`;
      const fresh = await tx.license.findUniqueOrThrow({
        where: { id: lic.id },
        include: { product: { include: { tenant: true } } },
      });
      if (fresh.product.tenant.status !== TenantStatus.ACTIVE)
        throw new Error("Vendor/tenant suspended");
      if (
        fresh.product.tenant.publicId !== hello.tenantId ||
        fresh.product.publicId !== hello.applicationId
      )
        throw new Error("Application namespace mismatch");
      if (fresh.status !== LicenseStatus.ACTIVE)
        throw new Error(`License ${fresh.status.toLowerCase()}`);
      if (fresh.expiresAt && fresh.expiresAt <= new Date())
        throw new Error("License expired");

      const byClient = await tx.activation.findUnique({
        where: { clientId: hello.clientId },
      });
      if (byClient?.state === ClientState.BANNED)
        throw new Error(byClient.banReason ?? "Client installation banned");
      if (
        byClient?.tlsCertFingerprint &&
        byClient.tlsCertFingerprint !== tlsCertFingerprint
      )
        throw new Error("Client certificate does not match this installation");
      if (
        byClient &&
        (!safeHashEqual(
          byClient.hwidHash,
          serverHwidHash(hello.hwid, byClient.licenseId),
        ) ||
          byClient.tenantPublicId !== hello.tenantId ||
          byClient.productPublicId !== hello.applicationId)
      ) {
        throw new Error(
          "Client identity already bound to a different application or HWID",
        );
      }

      const existing = await tx.activation.findUnique({
        where: { licenseId_hwidHash: { licenseId: lic.id, hwidHash } },
      });
      if (existing?.state === ClientState.BANNED)
        throw new Error(existing.banReason ?? "Client installation banned");
      if (
        existing?.tlsCertFingerprint &&
        existing.tlsCertFingerprint !== tlsCertFingerprint
      )
        throw new Error("Client certificate does not match this activation");
      if (existing && existing.clientId !== hello.clientId)
        throw new Error(
          "HWID already bound to a different installation ID; an administrator must reset it",
        );
      const activationCount = await tx.activation.count({
        where: { licenseId: lic.id },
      });
      if (!existing && activationCount >= fresh.maxActivations)
        throw new Error("Activation limit reached");

      if (byClient && byClient.licenseId !== lic.id) {
        return tx.activation.update({
          where: { id: byClient.id },
          data: {
            licenseId: lic.id,
            appVersion: hello.appVersion,
            platform: hello.platform,
            tlsCertFingerprint,
            tenantPublicId: hello.tenantId,
            productPublicId: hello.applicationId,
            state: ClientState.ONLINE,
            connectedAt: new Date(),
            lastHeartbeatAt: new Date(),
            disconnectedAt: null,
            lastIp: socket.remoteAddress,
          },
        });
      }

      return tx.activation.upsert({
        where: { licenseId_hwidHash: { licenseId: lic.id, hwidHash } },
        create: {
          licenseId: lic.id,
          clientId: hello.clientId,
          hwidHash,
          tenantPublicId: hello.tenantId,
          productPublicId: hello.applicationId,
          tlsCertFingerprint,
          appVersion: hello.appVersion,
          platform: hello.platform,
          state: ClientState.ONLINE,
          connectedAt: new Date(),
          lastHeartbeatAt: new Date(),
          lastIp: socket.remoteAddress,
        },
        update: {
          appVersion: hello.appVersion,
          platform: hello.platform,
          tlsCertFingerprint,
          tenantPublicId: hello.tenantId,
          productPublicId: hello.applicationId,
          state: ClientState.ONLINE,
          connectedAt: new Date(),
          lastHeartbeatAt: new Date(),
          disconnectedAt: null,
          lastIp: socket.remoteAddress,
        },
      });
    },
    { isolationLevel: "Serializable" },
  );

  await prisma.license.update({
    where: { id: lic.id },
    data: { lastValidatedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: {
      action: "CLIENT_VALIDATED",
      entityType: "Activation",
      entityId: activation.id,
      ip: socket.remoteAddress,
      details: {
        clientId: hello.clientId,
        tenantId: hello.tenantId,
        applicationId: hello.applicationId,
        product: lic.product.code,
        modules,
        ...(hello.appVersion ? { appVersion: hello.appVersion } : {}),
        ...(hello.platform ? { platform: hello.platform } : {}),
      },
    },
  });
  registry.get(hello.clientId)?.socket.destroy();
  registry.set({
    clientId: hello.clientId,
    activationId: activation.id,
    licenseId: lic.id,
    tenantPublicId: hello.tenantId,
    productPublicId: hello.applicationId,
    hwid: hello.hwid.toLowerCase(),
    socket,
    sequence: 0,
    connectedAt: new Date(),
  });
  writeMessage(socket, {
    type: "WELCOME",
    clientId: hello.clientId,
    licenseId: lic.id,
    state: "LICENSED",
    tenantId: hello.tenantId,
    applicationId: hello.applicationId,
    modules,
    entitlements,
    entitlementVersion: lic.entitlementVersion,
    licenseSerial: lic.serial,
    ...customerDetails(lic),
    validFrom: lic.validFrom.toISOString(),
    expiresAt: lic.expiresAt?.toISOString(),
    maxActivations: lic.maxActivations,
    appVersion: hello.appVersion,
    platform: hello.platform,
    heartbeatSeconds: HEARTBEAT_SECONDS,
    serverTime: Date.now(),
  });
  return hello.clientId;
}

async function handleProvisioning(socket: TLSSocket, raw: unknown) {
  const request = provisionSchema.parse(raw);
  const payload = decodeProvisioningId(request.provisioningId);
  if (
    payload.clientId !== request.clientId ||
    payload.tenantId !== request.tenantId ||
    payload.applicationId !== request.applicationId ||
    payload.hwid !== request.hwid.toLowerCase()
  ) {
    throw new Error("Provisioning identity mismatch");
  }
  const application = await prisma.product.findFirst({
    where: {
      publicId: payload.applicationId,
      tenant: { publicId: payload.tenantId },
    },
    select: { id: true },
  });
  if (!application)
    throw new Error("Provisioning application is not registered");
  const banned = await prisma.activation.findUnique({
    where: { clientId: request.clientId },
    select: { state: true, banReason: true },
  });
  if (banned?.state === ClientState.BANNED)
    throw new Error(banned.banReason || "Client installation banned");
  const peer = socket.getPeerCertificate();
  if (
    config.TLS_REQUIRE_CLIENT_CERT &&
    (!peer || typeof peer.fingerprint256 !== "string")
  )
    throw new Error("Client certificate required");

  provisioningRegistry.get(request.clientId)?.socket.destroy();
  provisioningRegistry.delete(request.clientId);

  const activeLicense = await findActiveLicenseForInstallation(
    application.id,
    request.clientId,
    payload.hwid,
  );
  if (activeLicense) {
    const licRecord = await prisma.license.findUnique({
      where: { id: activeLicense.id },
      select: { metadata: true },
    });
    const meta =
      licRecord?.metadata &&
      typeof licRecord.metadata === "object" &&
      !Array.isArray(licRecord.metadata)
        ? (licRecord.metadata as Record<string, unknown>)
        : {};
    if (meta.provisioningId !== request.provisioningId) {
      await prisma.license.update({
        where: { id: activeLicense.id },
        data: {
          metadata: {
            ...meta,
            provisioningId: request.provisioningId,
          } as any,
        },
      });
    }
    const reissued = await reissueCurrentLicense(activeLicense.id);
    writeMessage(socket, { type: "LICENSE_READY", licenseKey: reissued.jwtKey });
    setTimeout(() => socket.end(), 250);
    return request.clientId;
  }

  provisioningRegistry.set({
    clientId: request.clientId,
    tenantPublicId: payload.tenantId,
    productPublicId: payload.applicationId,
    hwid: payload.hwid,
    socket,
    connectedAt: new Date(),
  });
  writeMessage(socket, { type: "PROVISIONING_WAIT", serverTime: Date.now() });
  return request.clientId;
}

export function deliverProvisionedLicense(
  input: {
    clientId: string;
    tenantId: string;
    applicationId: string;
    hwid?: string;
  },
  licenseKey: string,
) {
  const normalizedHwid = input.hwid ? input.hwid.toLowerCase() : undefined;
  const waiting = provisioningRegistry.get(input.clientId);
  if (
    waiting &&
    !waiting.socket.destroyed &&
    waiting.tenantPublicId === input.tenantId &&
    waiting.productPublicId === input.applicationId &&
    (!normalizedHwid || waiting.hwid === normalizedHwid)
  ) {
    provisioningRegistry.delete(input.clientId);
    writeMessage(waiting.socket, { type: "LICENSE_READY", licenseKey });
    setTimeout(() => waiting.socket.end(), 250);
    return true;
  }
  const active = registry.get(input.clientId);
  if (
    !active ||
    active.socket.destroyed ||
    active.tenantPublicId !== input.tenantId ||
    active.productPublicId !== input.applicationId ||
    (normalizedHwid && active.hwid !== normalizedHwid)
  )
    return false;
  writeMessage(active.socket, { type: "LICENSE_READY", licenseKey });
  return true;
}

export async function pushLicenseEvent(
  clientId: string,
  event: string,
  reason?: string | null,
) {
  const live = registry.get(clientId);
  if (!live) return false;
  live.sequence += 1;
  const current = await currentEntitlements(live.licenseId);
  const signedEvent = await signStateEvent({
    clientId,
    licenseId: live.licenseId,
    tenantPublicId: live.tenantPublicId,
    productPublicId: live.productPublicId,
    event,
    sequence: live.sequence,
    entitlementVersion: current.lic.entitlementVersion,
    modules: current.modules,
    entitlements: current.entitlements,
    reason,
  });
  writeMessage(live.socket, { type: "LICENSE_EVENT", event, signedEvent });
  return true;
}

async function sendEntitlements(clientId: string, nonce: string) {
  const live = registry.get(clientId);
  if (!live) throw new Error("Client not registered");
  const current = await currentEntitlements(live.licenseId);
  live.sequence += 1;
  const signedEvent = await signStateEvent({
    clientId,
    licenseId: live.licenseId,
    tenantPublicId: live.tenantPublicId,
    productPublicId: live.productPublicId,
    event: "ENTITLEMENTS_SNAPSHOT",
    sequence: live.sequence,
    entitlementVersion: current.lic.entitlementVersion,
    modules: current.modules,
    entitlements: current.entitlements,
  });
  writeMessage(live.socket, {
    type: "ENTITLEMENTS",
    nonce,
    modules: current.modules,
    entitlements: current.entitlements,
    entitlementVersion: current.lic.entitlementVersion,
    signedEvent,
  });
}

export function startTcpServer() {
  const server = createServer(
    {
      key: readFileSync(config.TLS_KEY_PATH),
      cert: readFileSync(config.TLS_CERT_PATH),
      ca: [readFileSync(config.TLS_CA_PATH)],
      minVersion: "TLSv1.3",
      requestCert: config.TLS_REQUIRE_CLIENT_CERT,
      rejectUnauthorized: config.TLS_REQUIRE_CLIENT_CERT,
    },
    (socket) => {
      socket.setKeepAlive(true, 30_000);
      socket.setNoDelay(true);
      let buffer = "";
      let deadline: NodeJS.Timeout | undefined;
      const resetDeadline = (ms: number) => {
        if (deadline) clearTimeout(deadline);
        deadline = setTimeout(() => socket.destroy(), ms);
      };
      resetDeadline(10_000);
      let clientId: string | undefined;
      let authenticated = false;
      let provisioning = false;
      let processing = Promise.resolve();

      socket.on("data", (chunk) => {
        socket.pause();
        processing = processing.then(async () => {
          try {
            buffer += chunk.toString("utf8");
            if (buffer.length > MAX_LINE) throw new Error("Frame too large");
            let newline: number;
            while ((newline = buffer.indexOf("\n")) >= 0) {
              const line = buffer.slice(0, newline).trim();
              buffer = buffer.slice(newline + 1);
              if (!line) continue;
              const msg = JSON.parse(line);
              if (!authenticated) {
                if (msg?.type === "PROVISION") {
                  clientId = await handleProvisioning(socket, msg);
                  authenticated = true;
                  provisioning = true;
                  resetDeadline(STALE_MS);
                  continue;
                }
                clientId = await handleHello(socket, msg);
                authenticated = true;
                resetDeadline(STALE_MS);
                continue;
              }
              if (!clientId) throw new Error("Client identity missing");
              if (provisioning) {
                provisionHeartbeatSchema.parse(msg);
                resetDeadline(STALE_MS);
                writeMessage(socket, {
                  type: "PROVISIONING_WAIT",
                  serverTime: Date.now(),
                });
                continue;
              }
              if (msg?.type === "ENTITLEMENTS_REQUEST") {
                const request = entitlementRequestSchema.parse(msg);
                resetDeadline(STALE_MS);
                await sendEntitlements(clientId, request.nonce);
                continue;
              }
              const hb = heartbeatSchema.parse(msg);
              resetDeadline(STALE_MS);
              const active = await prisma.activation.findUnique({
                where: { clientId },
                include: {
                  license: {
                    include: { product: { include: { tenant: true } } },
                  },
                },
              });
              const expired =
                !!active?.license.expiresAt &&
                active.license.expiresAt <= new Date();
              const namespaceMismatch =
                !!active &&
                (active.tenantPublicId !==
                  active.license.product.tenant.publicId ||
                  active.productPublicId !== active.license.product.publicId);
              if (
                !active ||
                active.state === ClientState.BANNED ||
                active.license.status !== LicenseStatus.ACTIVE ||
                active.license.product.tenant.status !== TenantStatus.ACTIVE ||
                expired ||
                namespaceMismatch
              ) {
                const reason =
                  active?.banReason ??
                  active?.license.revokeReason ??
                  (expired
                    ? "License expired"
                    : namespaceMismatch
                      ? "Application namespace mismatch"
                      : active?.license.product.tenant.status ===
                          TenantStatus.SUSPENDED
                        ? "Vendor/tenant suspended"
                        : "License no longer valid");
                const event =
                  active?.state === ClientState.BANNED
                    ? "CLIENT_BANNED"
                    : expired
                      ? "LICENSE_EXPIRED"
                      : active?.license.product.tenant.status ===
                          TenantStatus.SUSPENDED
                        ? "TENANT_SUSPENDED"
                        : active?.license.status === LicenseStatus.SUSPENDED
                          ? "LICENSE_SUSPENDED"
                          : "LICENSE_REVOKED";
                await pushLicenseEvent(clientId, event, reason);
                socket.end();
                return;
              }
              await prisma.activation.update({
                where: { id: active.id },
                data: {
                  lastHeartbeatAt: new Date(),
                  state: ClientState.ONLINE,
                },
              });
              writeMessage(socket, {
                type: "HEARTBEAT_ACK",
                serverTime: Date.now(),
                nonce: hb.nonce,
                entitlementVersion: active.license.entitlementVersion,
              });
            }
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Protocol error";
            writeMessage(socket, {
              type: "ERROR",
              code: "PROTOCOL_ERROR",
              message,
              fatal: true,
            });
            void prisma.auditLog
              .create({
                data: {
                  action: "TCP_PROTOCOL_REJECT",
                  entityType: "Client",
                  severity: AuditSeverity.WARNING,
                  ip: socket.remoteAddress,
                  details: { message, clientId },
                },
              })
              .catch((err) => console.error("audit write failed", err));
            socket.end();
          } finally {
            if (!socket.destroyed) socket.resume();
          }
        });
      });

      const cleanup = () => {
        if (deadline) clearTimeout(deadline);
        if (!clientId) return;
        if (provisioning) {
          if (provisioningRegistry.get(clientId)?.socket === socket)
            provisioningRegistry.delete(clientId);
        } else
          void disconnectClient(clientId, socket).catch((err) =>
            console.error("disconnect update failed", err),
          );
      };
      socket.on("close", cleanup);
      socket.on("error", cleanup);
    },
  );

  server.on("tlsClientError", (error, socket) => {
    void prisma.auditLog
      .create({
        data: {
          action: "TCP_TLS_REJECT",
          entityType: "Client",
          severity: AuditSeverity.WARNING,
          ip: socket.remoteAddress,
          details: { message: error.message },
        },
      })
      .catch((err) => console.error("audit write failed", err));
  });
  server.listen(config.TCP_PORT, "0.0.0.0", () =>
    console.log(`License TLS/TCP server listening on :${config.TCP_PORT}`),
  );
  return server;
}
