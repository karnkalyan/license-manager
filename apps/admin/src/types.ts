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
  lastIp?: string;
  connectedAt?: string;
  tenantPublicId: string;
  productPublicId: string;
  license: {
    id: string;
    serial: string;
    status: string;
    product: { name: string; publicId: string; tenant: Tenant };
    modules: { module: Module }[];
    dealer?: { id: string; username: string; dealerName?: string | null } | null;
  };
};

export type License = {
  id: string;
  serial: string;
  customerRef?: string;
  customerTenant?: string;
  dealerId?: string | null;
  dealer?: {
    id: string;
    username: string;
    dealerName?: string | null;
    dealerPhone?: string | null;
    dealerEmail?: string | null;
  } | null;
  metadata?: {
    customerName?: string;
    customerEmail?: string;
    entitlements?: Record<string, boolean | number>;
    provisioningId?: string;
    lastExtendedAt?: string;
  };
  status: string;
  jwtKey?: string;
  autoDelivered?: boolean;
  autoActivationRequested?: boolean;
  maxActivations: number;
  entitlementVersion: number;
  validFrom?: string;
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
  role: "SUPER_ADMIN" | "ADMIN" | "SUPPORT" | "MONITORING" | "VENDOR" | "AUDITOR" | "DEALER" | "FRANCHISE";
  tenantId?: string | null;
  dealerName?: string | null;
  dealerPhone?: string | null;
  dealerEmail?: string | null;
  dealerProducts?: { productId: string; product: { id: string; name: string; code: string; publicId: string } }[];
  tenant?: { id: string; name: string; code: string } | null;
  forcePasswordChange: boolean;
};

export type ManagedUser = Omit<SessionUser, "forcePasswordChange"> & {
  isActive: boolean;
  forcePasswordChange: boolean;
  lastLoginAt?: string;
  createdAt: string;
};

export type Dealer = {
  id: string;
  username: string;
  role: "DEALER" | "FRANCHISE";
  dealerName: string;
  dealerPhone?: string | null;
  dealerEmail?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
  tenantId?: string | null;
  tenant?: Tenant | null;
  dealerProducts: {
    product: Product;
  }[];
  _count?: {
    dealerLicenses: number;
  };
};

export type ApiKey = {
  id: string;
  key: string;
  name: string;
  allowedDomains: string;
  role: "READ_EXTEND" | "READ_ONLY" | "FULL";
  dealerId?: string | null;
  dealer?: { id: string; username: string; dealerName?: string | null } | null;
  createdBy?: { id: string; username: string } | null;
  expiresAt: string;
  isActive: boolean;
  isExpired?: boolean;
  lastUsedAt?: string | null;
  createdAt: string;
};

export type View =
  | "dashboard"
  | "licenses"
  | "clients"
  | "tenants"
  | "applications"
  | "dealers"
  | "api-keys"
  | "users"
  | "audit";

export type Subpage =
  | { type: "none" }
  | { type: "create-license"; defaultProduct?: Product }
  | { type: "license-details"; license: License }
  | { type: "license-edit"; license: License }
  | { type: "license-extend"; license: License }
  | { type: "create-application" }
  | { type: "application-details"; product: Product }
  | { type: "create-tenant" }
  | { type: "tenant-details"; tenant: Tenant }
  | { type: "client-details"; client: Activation }
  | { type: "create-dealer" }
  | { type: "dealer-details"; dealer: Dealer }
  | { type: "create-user" }
  | { type: "create-api-key" }
  | { type: "api-docs" };
