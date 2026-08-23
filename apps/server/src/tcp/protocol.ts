import { z } from "zod";

export const helloSchema = z.object({
  type: z.literal("HELLO"),
  protocol: z.literal(2),
  clientId: z.string().uuid(),
  licenseKey: z.string().min(50),
  tenantId: z.string().uuid(),
  applicationId: z.string().uuid(),
  hwid: z.string().regex(/^[a-fA-F0-9]{64}$/),
  appVersion: z.string().max(64).optional(),
  platform: z.string().max(64).optional(),
});

export const heartbeatSchema = z.object({
  type: z.literal("HEARTBEAT"),
  ts: z.number().int().positive(),
  nonce: z.string().min(8).max(128),
});

export const entitlementRequestSchema = z.object({
  type: z.literal("ENTITLEMENTS_REQUEST"),
  nonce: z.string().min(8).max(128),
});

export const provisionSchema = z.object({
  type: z.literal("PROVISION"),
  protocol: z.literal(2),
  clientId: z.string().uuid(),
  tenantId: z.string().uuid(),
  applicationId: z.string().uuid(),
  hwid: z.string().regex(/^[a-fA-F0-9]{64}$/),
  provisioningId: z.string().min(1).max(8192),
});

export const provisionHeartbeatSchema = z.object({
  type: z.literal("PROVISION_HEARTBEAT"),
  ts: z.number().int().positive(),
});

export type ServerMessage =
  | {
      type: "WELCOME";
      clientId: string;
      licenseId: string;
      licenseSerial: string;
      state: "LICENSED";
      tenantId: string;
      applicationId: string;
      modules: string[];
      entitlements: Record<string, boolean | number>;
      entitlementVersion: number;
      customerName?: string;
      customerEmail?: string;
      validFrom: string;
      expiresAt?: string;
      maxActivations: number;
      appVersion?: string;
      platform?: string;
      heartbeatSeconds: number;
      serverTime: number;
    }
  | {
      type: "HEARTBEAT_ACK";
      serverTime: number;
      nonce: string;
      entitlementVersion: number;
    }
  | {
      type: "ENTITLEMENTS";
      nonce: string;
      modules: string[];
      entitlements: Record<string, boolean | number>;
      entitlementVersion: number;
      signedEvent: string;
    }
  | { type: "PROVISIONING_WAIT"; serverTime: number }
  | { type: "LICENSE_READY"; licenseKey: string }
  | { type: "LICENSE_EVENT"; event: string; signedEvent: string }
  | { type: "ERROR"; code: string; message: string; fatal?: boolean };

export function writeMessage(
  socket: NodeJS.WritableStream,
  message: ServerMessage,
) {
  socket.write(JSON.stringify(message) + "\n");
}
