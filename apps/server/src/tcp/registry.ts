import type { TLSSocket } from 'node:tls';

export type LiveClient = {
  clientId: string;
  activationId: string;
  licenseId: string;
  tenantPublicId: string;
  productPublicId: string;
  hwid: string;
  socket: TLSSocket;
  sequence: number;
  connectedAt: Date;
};

export type ProvisioningClient = {
  clientId: string;
  tenantPublicId: string;
  productPublicId: string;
  hwid: string;
  socket: TLSSocket;
  connectedAt: Date;
};

const clients = new Map<string, LiveClient>();
const provisioningClients = new Map<string, ProvisioningClient>();

export const registry = {
  set(client: LiveClient) { clients.set(client.clientId, client); },
  get(clientId: string) { return clients.get(clientId); },
  delete(clientId: string) { clients.delete(clientId); },
  list() { return [...clients.values()]; },
  size() { return clients.size; }
};

export const provisioningRegistry = {
  set(client: ProvisioningClient) { provisioningClients.set(client.clientId, client); },
  get(clientId: string) { return provisioningClients.get(clientId); },
  delete(clientId: string) { provisioningClients.delete(clientId); },
  size() { return provisioningClients.size; }
};
