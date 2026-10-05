import { useState, useEffect } from "react";
import {
  AppWindow,
  Ban,
  Building2,
  CheckCircle2,
  Copy,
  Cpu,
  KeyRound,
  Layers3,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { api } from "../lib/api";
import type {
  Activation,
  Capability,
  License,
  ManagedUser,
  Product,
  SessionUser,
  Tenant,
} from "../types";

export function ModalFrame({
  title,
  subtitle,
  onClose,
  children,
  compact = false,
  wide = false,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
  compact?: boolean;
  wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal ${compact ? "compact-modal" : ""} ${wide ? "wide-modal" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            <p>{subtitle}</p>
          </div>
          <button className="icon" onClick={onClose} aria-label="Close modal">
            <XCircle size={19} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function initialEntitlements(
  capabilities: Capability[],
  current: Record<string, boolean | number> = {},
) {
  return Object.fromEntries(
    capabilities.map((capability) => [
      capability.code,
      current[capability.code] ??
        capability.defaultValue ??
        (capability.type === "boolean" ? false : (capability.min ?? 0)),
    ]),
  );
}

export function CapabilitySelector({
  capabilities,
  values,
  onChange,
}: {
  capabilities: Capability[];
  values: Record<string, boolean | number>;
  onChange: (code: string, value: boolean | number) => void;
}) {
  return (
    <div className="module-selector">
      {capabilities.map((capability) =>
        capability.type === "boolean" ? (
          <label
            className="module-option capability-option capability-boolean"
            key={capability.code}
          >
            <input
              type="checkbox"
              checked={values[capability.code] === true}
              onChange={(event) =>
                onChange(capability.code, event.target.checked)
              }
            />
            <span>
              <strong>{capability.code}</strong>
              <small>{capability.name}</small>
            </span>
          </label>
        ) : (
          <label
            className="capability-option capability-number"
            key={capability.code}
          >
            <span className="capability-copy">
              <strong>{capability.code}</strong>
              <small>
                {capability.name}
                {capability.unit ? ` (${capability.unit})` : ""}
              </small>
              <small className="capability-range">
                Enter whole number from {capability.min ?? 0} to{" "}
                {capability.max ?? 1000000}
              </small>
            </span>
            <span className="capability-number-control">
              <input
                aria-label={capability.name}
                type="number"
                inputMode="numeric"
                min={capability.min ?? 0}
                max={capability.max ?? 1000000}
                step={capability.step ?? 1}
                value={Number(
                  values[capability.code] ??
                    capability.defaultValue ??
                    capability.min ??
                    0,
                )}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => {
                  const value = event.currentTarget.valueAsNumber;
                  if (Number.isInteger(value)) onChange(capability.code, value);
                }}
              />
              {capability.unit && <em>{capability.unit}</em>}
            </span>
          </label>
        ),
      )}
    </div>
  );
}

export function productToDefaultCapabilities(product: Product): Capability[] {
  return (product.modules || []).map((m) => {
    if (m.code === "RECORDING_DEVICES") {
      return {
        code: m.code,
        name: m.name,
        description: m.description,
        type: "integer" as const,
        min: 0,
        max: 1000000,
        step: 1,
        defaultValue: 0,
        unit: "devices",
      };
    }
    if (m.code === "TRANSCODE_QUEUE_ITEMS") {
      return {
        code: m.code,
        name: m.name,
        description: m.description,
        type: "integer" as const,
        min: 0,
        max: 1000000,
        step: 1,
        defaultValue: 0,
        unit: "jobs",
      };
    }
    return {
      code: m.code,
      name: m.name,
      description: m.description,
      type: "boolean" as const,
      defaultValue: false,
    };
  });
}

export function CreateUser({
  tenants,
  isSuperAdmin,
  onClose,
  onCreated,
}: {
  tenants: Tenant[];
  isSuperAdmin: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<SessionUser["role"]>("SUPPORT");
  const [tenantId, setTenantId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/users", {
        method: "POST",
        body: JSON.stringify({
          username,
          password,
          role,
          tenantId: role === "VENDOR" ? tenantId : null,
        }),
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "User creation failed");
      setLoading(false);
    }
  }

  return (
    <ModalFrame
      title="Add system user"
      subtitle="Assign operational access and vendor scope authorization"
      onClose={onClose}
      compact
    >
      <form className="form-grid" onSubmit={submit}>
        <label>
          Username
          <input
            required
            minLength={3}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="name or email alias"
          />
        </label>
        <label>
          Temporary password
          <input
            required
            type="password"
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="12+ characters"
          />
        </label>
        <label className="full">
          Role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as SessionUser["role"])}
          >
            {isSuperAdmin ? <option value="SUPER_ADMIN">Super admin</option> : null}
            <option value="ADMIN">Admin</option>
            <option value="SUPPORT">Support</option>
            <option value="MONITORING">Monitoring</option>
            <option value="AUDITOR">Auditor</option>
            <option value="VENDOR">Vendor (own licenses only)</option>
          </select>
        </label>
        {role === "VENDOR" ? (
          <label className="full">
            Vendor scope
            <select
              required
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
            >
              <option value="">Select vendor</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name} ({tenant.code})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <p className="form-help full">
          User must update their bootstrap password at first login.
        </p>
        {error ? <div className="error full">{error}</div> : null}
        <div className="modal-actions full">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={loading}>
            {loading ? "Creating…" : "Create user"}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

export function CreateTenant({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/tenants", {
        method: "POST",
        body: JSON.stringify({
          code: code
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9_-]/g, "_"),
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
      setLoading(false);
    }
  }

  return (
    <ModalFrame
      title="Add vendor / tenant"
      subtitle="Creates an isolated licensing and cryptographic namespace."
      onClose={onClose}
      compact
    >
      <form onSubmit={submit} className="ban-form">
        <label>
          Vendor code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="VENDOR_A"
            required
          />
        </label>
        <label>
          Organization name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Media Corp"
            required
          />
        </label>
        <label>
          Description
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional tenant details or customer notes"
          />
        </label>
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={loading}>
            {loading ? "Creating…" : "Create vendor"}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

export function CreateApplication({
  tenants,
  onClose,
  onCreated,
}: {
  tenants: Tenant[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [tenantId, setTenantId] = useState(tenants[0]?.id || "");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/applications", {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          code: code
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9_-]/g, "_"),
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
      setLoading(false);
    }
  }

  return (
    <ModalFrame
      title="Add application"
      subtitle="Creates a product entry. Modules will synchronize via client provisioning ID."
      onClose={onClose}
    >
      <form onSubmit={submit} className="form-grid">
        <label>
          Assigned vendor
          <select
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            required
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.code})
              </option>
            ))}
          </select>
        </label>
        <label>
          Application code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="DESKTOP_PRO"
            required
          />
        </label>
        <label>
          Application name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Broadcast Playout Pro"
            required
          />
        </label>
        <label>
          Description
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional application description"
          />
        </label>
        {error && <div className="error full">{error}</div>}
        <div className="modal-actions full">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={loading}>
            Create application
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

export function CreateLicense({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [resolvedProduct, setResolvedProduct] = useState<Product | null>(null);
  const selected = resolvedProduct;
  const [entitlements, setEntitlements] = useState<Record<string, boolean | number>>({});
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [provisioningId, setProvisioningId] = useState("");
  const [autoActivate, setAutoActivate] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [provisioningError, setProvisioningError] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxActivations, setMaxActivations] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<License | null>(null);

  useEffect(() => {
    const value = provisioningId.trim();
    setProvisioningError("");
    if (!value) {
      setResolvedProduct(null);
      setEntitlements({});
      return;
    }
    if (!value.startsWith("KTX1.")) {
      setResolvedProduct(null);
      setEntitlements({});
      setProvisioningError(
        "Paste the KTX1 provisioning ID displayed by the client application.",
      );
      return;
    }
    const timer = window.setTimeout(async () => {
      setResolving(true);
      try {
        const result = await api<{
          product: Product;
          hwid: string;
          capabilities: Capability[];
        }>("/applications/resolve-provisioning", {
          method: "POST",
          body: JSON.stringify({ provisioningId: value }),
        });
        const product = {
          ...result.product,
          capabilities: result.capabilities,
        };
        setResolvedProduct(product);
        setEntitlements(initialEntitlements(result.capabilities));
        setProvisioningError("");
      } catch (e) {
        setResolvedProduct(null);
        setEntitlements({});
        setProvisioningError(
          e instanceof Error ? e.message : "Provisioning ID lookup failed",
        );
      } finally {
        setResolving(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [provisioningId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!resolvedProduct) {
      setError("Paste and resolve client provisioning ID first");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const l = await api<License>("/licenses", {
        method: "POST",
        body: JSON.stringify({
          moduleIds: [],
          entitlements,
          provisioningId: provisioningId.trim(),
          customerName: customerName.trim() || undefined,
          customerEmail: customerEmail.trim() || undefined,
          expiresAt: expiresAt || undefined,
          maxActivations,
          autoActivate,
        }),
      });
      setCreated(l);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalFrame
      title={created ? "Cryptographic License Issued" : "Issue Client License"}
      subtitle={
        created
          ? "The signed JWT key is generated. Distribute to client or allow auto-activation."
          : "Paste the client provisioning ID to load certified capabilities and module catalog."
      }
      onClose={onClose}
      wide
    >
      {created ? (
        <KeyResult license={created} onDone={onCreated} />
      ) : (
        <form onSubmit={submit} className="form-grid">
          <label className="full">
            Client provisioning ID
            <input
              value={provisioningId}
              onChange={(e) => setProvisioningId(e.target.value)}
              placeholder="Paste KTX1… string from client application"
              autoFocus
            />
            <small>
              {resolving
                ? "Attesting client provisioning payload…"
                : resolvedProduct
                  ? `Matched application: ${resolvedProduct.name} (${resolvedProduct.modules.length} modules loaded)`
                  : "Provisioning ID securely supplies app-scoped HWID, vendor namespace, and supported modules."}
            </small>
          </label>
          {provisioningError && (
            <div className="error full">{provisioningError}</div>
          )}
          <label className="full">
            Resolved application & vendor
            <input
              readOnly
              value={
                selected
                  ? `${selected.tenant.name} · ${selected.name} (${selected.code})`
                  : "Waiting for valid client provisioning ID…"
              }
            />
            <small>
              {selected && (
                <>
                  Vendor ID: <span className="mono">{selected.tenant.publicId}</span> ·
                  App ID: <span className="mono">{selected.publicId}</span>
                </>
              )}
            </small>
          </label>
          <label>
            Customer name / organization
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Paramount Studios"
            />
          </label>
          <label>
            Contact email
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="admin@customer.com"
            />
          </label>
          <label>
            Seat capacity (Max activations)
            <input
              type="number"
              min="1"
              max="100"
              value={maxActivations}
              onChange={(e) => setMaxActivations(Number(e.target.value))}
            />
          </label>
          <label>
            Expiration date
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            <small>Leave empty for perpetual entitlement.</small>
          </label>
          <label className="full">
            <span className="module-option">
              <input
                type="checkbox"
                checked={autoActivate}
                onChange={(e) => setAutoActivate(e.target.checked)}
              />
              <span>
                <strong>Deliver over active mTLS channel automatically</strong>
                <small>
                  Instantly activates connected client session without requiring manual copy.
                </small>
              </span>
            </span>
          </label>
          <div className="full capability-field">
            <span>Client Entitlements & Feature Limits</span>
            {selected && (
              <CapabilitySelector
                capabilities={selected.capabilities || []}
                values={entitlements}
                onChange={(code, value) =>
                  setEntitlements((current) => ({ ...current, [code]: value }))
                }
              />
            )}
            {!selected && (
              <span className="muted">
                Paste valid KTX1 provisioning ID above to unlock certified modules.
              </span>
            )}
          </div>
          {error && <div className="error full">{error}</div>}
          <div className="modal-actions full">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={
                loading ||
                resolving ||
                !resolvedProduct ||
                Boolean(provisioningError)
              }
            >
              <KeyRound size={16} />
              {loading ? "Issuing license…" : "Generate signed license"}
            </button>
          </div>
        </form>
      )}
    </ModalFrame>
  );
}

export function ReissueModules({
  license,
  onClose,
  onDone,
}: {
  license: License;
  onClose: () => void;
  onDone: () => void;
}) {
  const rememberedId = license.metadata?.provisioningId || "";
  const [provisioningId, setProvisioningId] = useState(rememberedId);
  const [catalog, setCatalog] = useState<Product | null>(() => {
    if (license.product?.modules?.length) {
      return {
        ...license.product,
        capabilities: productToDefaultCapabilities(license.product),
      };
    }
    return null;
  });
  const [entitlements, setEntitlements] = useState<Record<string, boolean | number>>(() => {
    const current =
      license.metadata?.entitlements ||
      Object.fromEntries(license.modules.map((item) => [item.module.code, true]));
    const defaultCaps = license.product?.modules
      ? productToDefaultCapabilities(license.product)
      : [];
    return initialEntitlements(defaultCaps, current);
  });
  const [customerName, setCustomerName] = useState(
    license.metadata?.customerName || license.customerRef || "",
  );
  const [customerEmail, setCustomerEmail] = useState(
    license.metadata?.customerEmail || "",
  );
  const [expiresAt, setExpiresAt] = useState(
    license.expiresAt?.slice(0, 10) || "",
  );
  const [autoActivate, setAutoActivate] = useState(true);
  const [created, setCreated] = useState<License | null>(null);
  const [error, setError] = useState("");
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    const value = provisioningId.trim();
    if (!value) {
      if (license.product?.modules?.length) {
        const caps = productToDefaultCapabilities(license.product);
        setCatalog({ ...license.product, capabilities: caps });
        const current =
          license.metadata?.entitlements ||
          Object.fromEntries(license.modules.map((item) => [item.module.code, true]));
        setEntitlements(initialEntitlements(caps, current));
      } else {
        setCatalog(null);
        setEntitlements({});
      }
      setError("");
      return;
    }
    if (!value.startsWith("KTX1.")) {
      setError("Paste valid KTX1 provisioning ID or leave blank to keep current.");
      return;
    }
    const timer = window.setTimeout(async () => {
      setResolving(true);
      setError("");
      try {
        const result = await api<{
          product: Product;
          hwid: string;
          capabilities: Capability[];
        }>("/applications/resolve-provisioning", {
          method: "POST",
          body: JSON.stringify({ provisioningId: value }),
        });
        setCatalog({ ...result.product, capabilities: result.capabilities });
        setEntitlements((prev) => initialEntitlements(result.capabilities, prev));
      } catch (e) {
        if (license.product?.modules?.length) {
          const caps = productToDefaultCapabilities(license.product);
          setCatalog({ ...license.product, capabilities: caps });
        } else {
          setCatalog(null);
          setEntitlements({});
        }
        setError(e instanceof Error ? e.message : "Provisioning lookup failed");
      } finally {
        setResolving(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [provisioningId, license]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!catalog) return;
    setError("");
    try {
      const l = await api<License>(`/licenses/${license.id}/modules`, {
        method: "POST",
        body: JSON.stringify({
          provisioningId: provisioningId.trim() || undefined,
          moduleIds: [],
          entitlements,
          customerName: customerName.trim() || undefined,
          customerEmail: customerEmail.trim() || undefined,
          expiresAt: expiresAt || undefined,
          autoActivate,
        }),
      });
      setCreated(l);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reissue failed");
    }
  }

  return (
    <ModalFrame
      title={created ? "Replacement Key Issued" : "Update Entitlements & Reissue"}
      subtitle={
        created
          ? "The previous cryptographic JWT is now revoked on client reconnects."
          : `Managing license: ${license.serial}`
      }
      onClose={onClose}
      wide
    >
      {created ? (
        <KeyResult license={created} onDone={onDone} />
      ) : (
        <form onSubmit={submit} className="ban-form">
          <div className="warning-box">
            <Layers3 size={17} />
            <span>
              Reissuing updates the signed entitlement version. Connected clients
              receive automatic hot-revalidation; old keys are revoked on reconnect.
            </span>
          </div>
          <label>
            Client provisioning ID
            <input
              value={provisioningId}
              onChange={(e) => setProvisioningId(e.target.value)}
              placeholder="Paste KTX1… (optional if client already provisioned)"
            />
            <small>
              {resolving
                ? "Reading client catalog…"
                : catalog
                  ? `${catalog.modules.length} application modules loaded.`
                  : "Optional if product modules are already registered."}
            </small>
          </label>
          <div className="form-grid" style={{ padding: 0 }}>
            <label>
              Customer / organization
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer name"
              />
            </label>
            <label>
              Contact email
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="admin@customer.com"
              />
            </label>
          </div>
          <label>
            Expiration date
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </label>
          {catalog && (
            <div className="capability-field">
              <span>Configured Entitlements & Capabilities</span>
              <CapabilitySelector
                capabilities={catalog.capabilities || []}
                values={entitlements}
                onChange={(code, value) =>
                  setEntitlements((current) => ({ ...current, [code]: value }))
                }
              />
            </div>
          )}
          {error && <div className="error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary" disabled={!catalog || resolving}>
              Reissue key
            </button>
          </div>
        </form>
      )}
    </ModalFrame>
  );
}

export function KeyResult({
  license,
  onDone,
}: {
  license: License;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const delivery = license.autoDelivered
    ? "Delivered securely to connected client over mTLS. Kashtrix is activating automatically."
    : license.autoActivationRequested
      ? "Client was not actively connected. Copy and deliver JWT manually."
      : "Manual activation mode. Copy and deliver JWT to client application.";

  const handleCopy = () => {
    navigator.clipboard.writeText(license.jwtKey ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="created-license">
      <div className="success-icon">
        <CheckCircle2 size={24} />
      </div>
      <div className="key-header-info">
        <strong className="mono">{license.serial}</strong>
        <p className="result-meta">
          {license.product.tenant.name} · {license.product.name} · Entitlement v{license.entitlementVersion}
        </p>
      </div>

      <div className={license.autoDelivered ? "info-callout" : "warning-box"}>
        {delivery}
      </div>

      <div className="jwt-container">
        <label>Cryptographic JWT Token</label>
        <textarea readOnly value={license.jwtKey ?? ""} />
      </div>

      <div className="key-result-actions">
        <button className="btn" onClick={handleCopy}>
          <Copy size={16} />
          {copied ? "Copied to clipboard!" : "Copy JWT license key"}
        </button>
        <button className="btn primary wide" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}

export function BanClientModal({
  client,
  onClose,
  onConfirm,
}: {
  client: Activation;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3) {
      setError("Please provide a specific reason for banning");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onConfirm(reason.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ban failed");
      setLoading(false);
    }
  }

  return (
    <ModalFrame
      title="Ban client installation"
      subtitle={`Client ID: ${client.clientId}`}
      onClose={onClose}
      compact
    >
      <form onSubmit={submit} className="ban-form">
        <div className="warning-box">
          <Ban size={17} />
          <span>
            This installation receives a signed CLIENT_BANNED revocation payload
            and its mTLS session is immediately terminated.
          </span>
        </div>
        <label>
          Audit reason
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="e.g. Hardware tampering detected, duplicate machine ID"
            required
          />
        </label>
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn danger-btn" disabled={loading}>
            {loading ? "Banning…" : "Confirm client ban"}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

// ============================================
// NEW COMPREHENSIVE DETAIL MODALS REQUESTED BY USER
// ============================================

export function LicenseDetailsModal({
  license,
  onClose,
  onEditModules,
  onStatus,
  onDelete,
  canManage,
}: {
  license: License;
  onClose: () => void;
  onEditModules: (l: License) => void;
  onStatus: (id: string, s: string) => void;
  onDelete: (l: License) => void;
  canManage: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copySerial = () => {
    navigator.clipboard.writeText(license.serial);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const entitlements = license.metadata?.entitlements || {};
  const entitlementEntries = Object.entries(entitlements);

  return (
    <ModalFrame
      title="License Specification & Details"
      subtitle={`Serial: ${license.serial}`}
      onClose={onClose}
      wide
    >
      <div className="details-container">
        {/* Top Header Card */}
        <div className="details-banner">
          <div className="details-banner-left">
            <span className="mono serial-code">{license.serial}</span>
            <button
              className="mini-btn copy-btn"
              onClick={copySerial}
              title="Copy license serial"
            >
              <Copy size={13} />
              {copied ? "Copied" : "Copy Serial"}
            </button>
          </div>
          <div className="details-banner-right">
            <span className={`badge ${license.status.toLowerCase()}`}>
              {license.status}
            </span>
          </div>
        </div>

        {/* 2-Column Info Grid */}
        <div className="details-grid">
          <div className="details-group">
            <h4>Customer & Assignment</h4>
            <div className="detail-row">
              <span>Customer Name:</span>
              <strong>{license.metadata?.customerName || license.customerRef || "Unassigned"}</strong>
            </div>
            <div className="detail-row">
              <span>Customer Email:</span>
              <strong>{license.metadata?.customerEmail || "Not specified"}</strong>
            </div>
            <div className="detail-row">
              <span>Vendor / Tenant:</span>
              <strong>{license.product.tenant.name} ({license.product.tenant.code})</strong>
            </div>
            <div className="detail-row">
              <span>Application:</span>
              <strong>{license.product.name} ({license.product.code})</strong>
            </div>
          </div>

          <div className="details-group">
            <h4>Entitlement Parameters</h4>
            <div className="detail-row">
              <span>Entitlement Version:</span>
              <strong>v{license.entitlementVersion}</strong>
            </div>
            <div className="detail-row">
              <span>Created Date:</span>
              <strong>{new Date(license.createdAt).toLocaleString()}</strong>
            </div>
            <div className="detail-row">
              <span>Expiration Date:</span>
              <strong>
                {license.expiresAt
                  ? new Date(license.expiresAt).toLocaleDateString()
                  : "Perpetual (No Expiration)"}
              </strong>
            </div>
            <div className="detail-row">
              <span>Seat Allocation:</span>
              <strong>
                {license.activations.length} / {license.maxActivations} Seats Used
              </strong>
            </div>
          </div>
        </div>

        {/* Modules & Capabilities */}
        <div className="details-section">
          <h4>Configured Modules & Feature Flags</h4>
          <div className="chips">
            {license.modules.map((m) => (
              <span className="chip" key={m.module.id}>
                {m.module.code}
              </span>
            ))}
            {!license.modules.length && (
              <span className="muted">No explicit module restrictions</span>
            )}
          </div>
        </div>

        {entitlementEntries.length > 0 && (
          <div className="details-section">
            <h4>Assigned Capabilities & Limits</h4>
            <div className="capability-table-wrap">
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Capability Code</th>
                    <th>Value / Limit</th>
                  </tr>
                </thead>
                <tbody>
                  {entitlementEntries.map(([code, val]) => (
                    <tr key={code}>
                      <td className="mono">{code}</td>
                      <td>
                        <strong>
                          {typeof val === "boolean" ? (val ? "Enabled" : "Disabled") : val}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Connected Client Activations */}
        <div className="details-section">
          <h4>Connected Activations ({license.activations.length})</h4>
          {license.activations.length > 0 ? (
            <div className="activations-list">
              {license.activations.map((a) => (
                <div key={a.id} className="activation-item">
                  <div className="activation-id mono">{a.clientId}</div>
                  <div className="activation-meta">
                    <span>{a.platform || "Platform Unknown"}</span> ·{" "}
                    <span>v{a.appVersion || "1.0"}</span>
                  </div>
                  <span className={`badge ${a.socketOnline ? "online" : a.state.toLowerCase()}`}>
                    {a.socketOnline ? "ONLINE" : a.state}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No clients have activated with this license yet.</p>
          )}
        </div>

        {/* Bottom Actions */}
        {canManage && (
          <div className="details-actions">
            <button
              className="btn"
              onClick={() => {
                onClose();
                onEditModules(license);
              }}
            >
              <KeyRound size={15} /> Edit Modules / Reissue
            </button>
            {license.status === "ACTIVE" ? (
              <button
                className="btn danger-btn"
                onClick={() => {
                  onStatus(license.id, "REVOKED");
                  onClose();
                }}
              >
                Revoke License
              </button>
            ) : (
              <button
                className="btn primary"
                onClick={() => {
                  onStatus(license.id, "ACTIVE");
                  onClose();
                }}
              >
                Restore License
              </button>
            )}
            <button
              className="btn danger-btn icon-btn"
              onClick={() => {
                onClose();
                onDelete(license);
              }}
              title="Permanently delete license"
            >
              <Trash2 size={15} /> Delete
            </button>
          </div>
        )}
      </div>
    </ModalFrame>
  );
}

export function ApplicationDetailsModal({
  product,
  onClose,
  licenses,
  clients,
  onIssueLicense,
}: {
  product: Product;
  onClose: () => void;
  licenses: License[];
  clients: Activation[];
  onIssueLicense?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const appLicenses = licenses.filter((l) => l.product?.id === product.id);
  const appClients = clients.filter(
    (c) => c.license?.product?.publicId === product.publicId,
  );

  const copyPublicId = () => {
    navigator.clipboard.writeText(product.publicId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ModalFrame
      title="Application Specification & Modules"
      subtitle={`${product.tenant.name} · ${product.name}`}
      onClose={onClose}
      wide
    >
      <div className="details-container">
        {/* Banner */}
        <div className="details-banner">
          <div className="details-banner-left">
            <div className="product-icon">
              <AppWindow size={20} />
            </div>
            <div>
              <h3>{product.name}</h3>
              <p className="mono">{product.code}</p>
            </div>
          </div>
          <div className="details-banner-right">
            <button className="mini-btn" onClick={copyPublicId}>
              <Copy size={13} />
              {copied ? "Copied" : "Copy App UUID"}
            </button>
          </div>
        </div>

        {/* Overview */}
        <div className="details-grid">
          <div className="details-group">
            <h4>Vendor Association</h4>
            <div className="detail-row">
              <span>Vendor Name:</span>
              <strong>{product.tenant.name}</strong>
            </div>
            <div className="detail-row">
              <span>Vendor Code:</span>
              <strong className="mono">{product.tenant.code}</strong>
            </div>
            <div className="detail-row">
              <span>Vendor UUID:</span>
              <strong className="mono id-text">{product.tenant.publicId}</strong>
            </div>
          </div>

          <div className="details-group">
            <h4>Operational Metrics</h4>
            <div className="detail-row">
              <span>Active Licenses:</span>
              <strong>{appLicenses.filter((l) => l.status === "ACTIVE").length} / {appLicenses.length} Total</strong>
            </div>
            <div className="detail-row">
              <span>Connected Clients:</span>
              <strong>{appClients.filter((c) => c.socketOnline).length} Online / {appClients.length} Total</strong>
            </div>
            <div className="detail-row">
              <span>Registered Modules:</span>
              <strong>{product.modules.length} modules</strong>
            </div>
          </div>
        </div>

        {/* Modules Catalog */}
        <div className="details-section">
          <h4>Client Advertised Modules ({product.modules.length})</h4>
          {product.modules.length > 0 ? (
            <div className="module-spec-grid">
              {product.modules.map((m) => (
                <div key={m.id} className="module-spec-card">
                  <div className="module-spec-head">
                    <strong className="mono">{m.code}</strong>
                    <span className={`badge ${m.enabled ? "active" : "revoked"}`}>
                      {m.enabled ? "ENABLED" : "DISABLED"}
                    </span>
                  </div>
                  <h5>{m.name}</h5>
                  <p>{m.description || "Synchronized from client provisioning catalog."}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">
              Waiting for client application to connect and advertise its module catalog via KTX1 provisioning ID.
            </p>
          )}
        </div>

        {/* Capabilities Spec */}
        {product.capabilities && product.capabilities.length > 0 && (
          <div className="details-section">
            <h4>Application Capabilities</h4>
            <div className="capability-table-wrap">
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Capability</th>
                    <th>Type</th>
                    <th>Default</th>
                    <th>Range</th>
                    <th>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {product.capabilities.map((c) => (
                    <tr key={c.code}>
                      <td className="mono">
                        <strong>{c.code}</strong>
                        <small>{c.name}</small>
                      </td>
                      <td>{c.type}</td>
                      <td>{String(c.defaultValue ?? "—")}</td>
                      <td>{c.min ?? 0} – {c.max ?? "—"}</td>
                      <td>{c.unit || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="details-actions">
          {onIssueLicense && (
            <button
              className="btn primary"
              onClick={() => {
                onClose();
                onIssueLicense();
              }}
            >
              <KeyRound size={15} /> Issue New License for {product.name}
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}

export function VendorDetailsModal({
  tenant,
  onClose,
  products,
  licenses,
  onStatus,
  canManage,
}: {
  tenant: Tenant;
  onClose: () => void;
  products: Product[];
  licenses: License[];
  onStatus: (t: Tenant, status: string) => void;
  canManage: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const vendorProducts = products.filter((p) => p.tenant?.id === tenant.id);
  const vendorLicenses = licenses.filter((l) => l.product?.tenant?.id === tenant.id);

  const copyId = () => {
    navigator.clipboard.writeText(tenant.publicId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ModalFrame
      title="Vendor / Tenant Organization"
      subtitle={tenant.name}
      onClose={onClose}
      wide
    >
      <div className="details-container">
        <div className="details-banner">
          <div className="details-banner-left">
            <div className="product-icon">
              <Building2 size={20} />
            </div>
            <div>
              <h3>{tenant.name}</h3>
              <p className="mono">{tenant.code}</p>
            </div>
          </div>
          <div className="details-banner-right">
            <span className={`badge ${tenant.status.toLowerCase()}`}>
              {tenant.status}
            </span>
            <button className="mini-btn" onClick={copyId}>
              <Copy size={13} />
              {copied ? "Copied" : "Copy Namespace UUID"}
            </button>
          </div>
        </div>

        <div className="details-grid">
          <div className="details-group">
            <h4>Namespace Isolation</h4>
            <div className="detail-row">
              <span>Public Namespace UUID:</span>
              <strong className="mono id-text">{tenant.publicId}</strong>
            </div>
            <div className="detail-row">
              <span>Tenant Status:</span>
              <strong>{tenant.status === "ACTIVE" ? "Active (Operational)" : "Suspended"}</strong>
            </div>
            <div className="detail-row">
              <span>Description:</span>
              <span>{tenant.description || "Enterprise licensing organization."}</span>
            </div>
          </div>

          <div className="details-group">
            <h4>Ecosystem Volume</h4>
            <div className="detail-row">
              <span>Registered Applications:</span>
              <strong>{vendorProducts.length} applications</strong>
            </div>
            <div className="detail-row">
              <span>Total Licenses Issued:</span>
              <strong>{vendorLicenses.length} licenses</strong>
            </div>
            <div className="detail-row">
              <span>Active Deployments:</span>
              <strong>{vendorLicenses.filter((l) => l.status === "ACTIVE").length} active</strong>
            </div>
          </div>
        </div>

        <div className="details-section">
          <h4>Applications under {tenant.name} ({vendorProducts.length})</h4>
          <div className="tenant-apps-list">
            {vendorProducts.map((p) => (
              <div key={p.id} className="tenant-app-item">
                <div className="product-icon">
                  <AppWindow size={16} />
                </div>
                <div className="grow">
                  <strong>{p.name}</strong>
                  <span className="mono">{p.code}</span>
                </div>
                <div className="tenant-app-stats">
                  <span>{p.modules.length} modules</span>
                  <strong>{licenses.filter((l) => l.product?.id === p.id).length} licenses</strong>
                </div>
              </div>
            ))}
            {!vendorProducts.length && (
              <p className="muted">No applications created for this vendor yet.</p>
            )}
          </div>
        </div>

        {canManage && (
          <div className="details-actions">
            <button
              className={`btn ${tenant.status === "ACTIVE" ? "danger-btn" : "primary"}`}
              onClick={() => {
                onStatus(tenant, tenant.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE");
                onClose();
              }}
            >
              {tenant.status === "ACTIVE" ? "Suspend Vendor" : "Activate Vendor"}
            </button>
            <button className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </ModalFrame>
  );
}

export function ClientDetailsModal({
  client,
  onClose,
  canSupport,
  canManage,
  onRevalidate,
  onBan,
}: {
  client: Activation;
  onClose: () => void;
  canSupport: boolean;
  canManage: boolean;
  onRevalidate: (c: Activation) => void;
  onBan: (c: Activation) => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyClientId = () => {
    navigator.clipboard.writeText(client.clientId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ModalFrame
      title="Client Hardware Attestation & Session"
      subtitle={`Client ID: ${client.clientId}`}
      onClose={onClose}
      wide
    >
      <div className="details-container">
        <div className="details-banner">
          <div className="details-banner-left">
            <div className="client-glyph">
              <Cpu size={20} />
            </div>
            <div>
              <h3 className="mono">{client.clientId}</h3>
              <p>Platform: {client.platform || "Standard Workstation"}</p>
            </div>
          </div>
          <div className="details-banner-right">
            <span
              className={`badge ${client.socketOnline ? "online" : client.state.toLowerCase()}`}
            >
              {client.socketOnline ? "ONLINE" : client.state}
            </span>
            <button className="mini-btn" onClick={copyClientId}>
              <Copy size={13} />
              {copied ? "Copied" : "Copy Client ID"}
            </button>
          </div>
        </div>

        <div className="details-grid">
          <div className="details-group">
            <h4>Hardware & Environment</h4>
            <div className="detail-row">
              <span>Platform Fingerprint:</span>
              <strong>{client.platform || "Unknown / Virtualized"}</strong>
            </div>
            <div className="detail-row">
              <span>Application Version:</span>
              <strong>v{client.appVersion || "1.0.0"}</strong>
            </div>
            <div className="detail-row">
              <span>mTLS Socket Session:</span>
              <strong style={{ color: client.socketOnline ? "var(--success)" : "var(--muted)" }}>
                {client.socketOnline ? "Active Encrypted Channel" : "Disconnected / Offline"}
              </strong>
            </div>
            <div className="detail-row">
              <span>Last Heartbeat:</span>
              <strong>
                {client.lastHeartbeatAt
                  ? new Date(client.lastHeartbeatAt).toLocaleString()
                  : "Never"}
              </strong>
            </div>
          </div>

          <div className="details-group">
            <h4>Assigned License & Application</h4>
            <div className="detail-row">
              <span>License Serial:</span>
              <strong className="mono">{client.license.serial}</strong>
            </div>
            <div className="detail-row">
              <span>Application:</span>
              <strong>{client.license.product.name}</strong>
            </div>
            <div className="detail-row">
              <span>Vendor / Tenant:</span>
              <strong>{client.license.product.tenant.name}</strong>
            </div>
            <div className="detail-row">
              <span>License Status:</span>
              <span className={`badge ${client.license.status.toLowerCase()}`}>
                {client.license.status}
              </span>
            </div>
          </div>
        </div>

        <div className="details-section">
          <h4>Active Modules for this Client</h4>
          <div className="chips">
            {client.license.modules.map((m) => (
              <span className="chip" key={m.module.id}>
                {m.module.code}
              </span>
            ))}
          </div>
        </div>

        <div className="details-actions">
          {canSupport && (
            <button
              className="btn"
              onClick={() => {
                onRevalidate(client);
                onClose();
              }}
            >
              <ShieldCheck size={15} /> Trigger Signed Revalidation
            </button>
          )}
          {canManage && (
            <button
              className={`btn ${client.state === "BANNED" ? "primary" : "danger-btn"}`}
              onClick={() => {
                onBan(client);
                onClose();
              }}
            >
              {client.state === "BANNED" ? "Unban Client" : "Ban Client"}
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}
