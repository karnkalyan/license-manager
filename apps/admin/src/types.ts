export type Dashboard = {
  licenses: number;
  active: number;
  revoked: number;
  activations: number;
  online: number;
  recentAudits: Audit[];
};

export type Tenant = {
  id: string;
  publicId: string;
  code: string;
  name: string;
  description?: string;
  status: string;
  _count?: { products: number };
};

export type Module = {
  id: string;
  publicId: string;
  code: string;
  name: string;
  description?: string;
  enabled: boolean;
};

export type Capability = {
  code: string;
  name: string;
  description?: string;
  type: "boolean" | "integer";
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: boolean | number;
  unit?: string;
};

export type Product = {
  id: string;
  publicId: string;
  code: string;
  name: string;
  description?: string;
  tenant: Tenant;
  modules: Module[];
  capabilities?: Capability[];
  _count?: { licenses: number };
};

export type Activation = {
  id: string;
  clientId: string;
  state: string;
  socketOnline?: boolean;
  provisioningOnline?: boolean;
  platform?: string;
  appVersion?: string;
  lastHeartbeatAt?: string;
  tenantPublicId: string;
  productPublicId: string;
  license: {
    id: string;
    serial: string;
    status: string;
    product: { name: string; publicId: string; tenant: Tenant };
    modules: { module: Module }[];
  };
};

export type License = {
  id: string;
  serial: string;
  customerRef?: string;
  metadata?: {
    customerName?: string;
    customerEmail?: string;
    entitlements?: Record<string, boolean | number>;
    provisioningId?: string;
  };
  status: string;
  jwtKey?: string;
  autoDelivered?: boolean;
  autoActivationRequested?: boolean;
  maxActivations: number;
  entitlementVersion: number;
  expiresAt?: string;
  createdAt: string;
  product: Product;
  modules: { module: Module }[];
  activations: Activation[];
};

export type Audit = {
  id: string;
  action: string;
  entityType: string;
  severity: string;
  createdAt: string;
  actor?: { username: string };
};

export type SessionUser = {
  id: string;
  username: string;
  role: "SUPER_ADMIN" | "ADMIN" | "SUPPORT" | "MONITORING" | "VENDOR" | "AUDITOR";
  tenantId?: string | null;
  tenant?: { id: string; name: string; code: string } | null;
  forcePasswordChange: boolean;
};

export type ManagedUser = Omit<SessionUser, "forcePasswordChange"> & {
  isActive: boolean;
  forcePasswordChange: boolean;
  lastLoginAt?: string;
  createdAt: string;
};

export type View =
  | "dashboard"
  | "licenses"
  | "clients"
  | "tenants"
  | "applications"
  | "users"
  | "audit";
