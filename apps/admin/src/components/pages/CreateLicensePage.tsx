import { useState, useEffect } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Cpu,
  KeyRound,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api } from "../../lib/api";
import type { Capability, Dealer, License, Product, SessionUser, Tenant } from "../../types";

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

export function CreateLicensePage({
  dealers,
  products,
  tenants,
  session,
  defaultProduct,
  onBack,
  onDone,
}: {
  dealers: Dealer[];
  products: Product[];
  tenants: Tenant[];
  session: SessionUser | null;
  defaultProduct?: Product;
  onBack: () => void;
  onDone: (message: string) => void;
}) {
  const isDealer = session?.role === "DEALER" || session?.role === "FRANCHISE";

  const [provisioningId, setProvisioningId] = useState("");
  const [resolvedProduct, setResolvedProduct] = useState<Product | null>(defaultProduct || null);
  const [entitlements, setEntitlements] = useState<Record<string, boolean | number>>({});
  const [customerName, setCustomerName] = useState("");
  const [customerTenant, setCustomerTenant] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [selectedDealerId, setSelectedDealerId] = useState("");
  const [autoActivate, setAutoActivate] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [provisioningError, setProvisioningError] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxActivations, setMaxActivations] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<License | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    const value = provisioningId.trim();
    setProvisioningError("");
    if (!value) {
      if (!defaultProduct) {
        setResolvedProduct(null);
        setEntitlements({});
      }
      return;
    }
    if (!value.startsWith("KTX1.")) {
      if (!defaultProduct) setResolvedProduct(null);
      setEntitlements({});
      setProvisioningError("Paste the KTX1 provisioning ID displayed by the client application.");
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
        if (!defaultProduct) setResolvedProduct(null);
        setEntitlements({});
        setProvisioningError(e instanceof Error ? e.message : "Provisioning ID lookup failed");
      } finally {
        setResolving(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [provisioningId, defaultProduct]);

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
          customerTenant: customerTenant.trim() || undefined,
          customerEmail: customerEmail.trim() || undefined,
          dealerId: isDealer ? session?.id : selectedDealerId || undefined,
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

  const copyJwt = () => {
    if (!created?.jwtKey) return;
    navigator.clipboard.writeText(created.jwtKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(null as any), 2000);
  };

  const capabilities = resolvedProduct?.capabilities || (resolvedProduct?.modules || []).map((m) => ({
    code: m.code,
    name: m.name,
    description: m.description,
    type: "boolean" as const,
    defaultValue: false,
  }));

  return (
    <div className="page-view-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-back">
          <button className="btn icon-btn back-btn" onClick={onBack} title="Back to licenses">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="page-breadcrumbs">
              <span>Licenses</span>
              <span className="sep">/</span>
              <span className="current">{created ? "License Result" : "Issue New License"}</span>
            </div>
            <h2>{created ? "Cryptographic License Issued" : "Issue Cryptographic License"}</h2>
          </div>
        </div>

        {created && (
          <button className="btn primary" onClick={() => onDone("License created and activated")}>
            <CheckCircle2 size={16} />
            <span>Finish & Return</span>
          </button>
        )}
      </div>

      {/* Result Page View */}
      {created ? (
        <div className="page-content-card result-card">
          <div className="result-header-badge">
            <div className="result-badge-icon">
              <ShieldCheck size={32} />
            </div>
            <div>
              <h3>Cryptographic Entitlement Generated</h3>
              <p>Serial Number: <strong className="mono pink-text">{created.serial}</strong></p>
            </div>
          </div>

          <div className="license-key-display-box">
            <div className="key-box-head">
              <strong>Signed JWT Entitlement Key (Ed25519)</strong>
              <button className="btn action-btn key-copy-btn" onClick={copyJwt}>
                <Copy size={14} />
                <span>{copiedKey ? "Copied!" : "Copy Key"}</span>
              </button>
            </div>
            <textarea readOnly rows={5} value={created.jwtKey || ""} className="mono key-textarea" />
          </div>

          <div className="result-details-grid">
            <div className="result-detail-item">
              <span className="label">Application</span>
              <strong>{created.product.name} ({created.product.code})</strong>
            </div>
            <div className="result-detail-item">
              <span className="label">Vendor Organization</span>
              <strong>{created.product.tenant.name}</strong>
            </div>
            <div className="result-detail-item">
              <span className="label">Customer Organization / Tenant</span>
              <strong>{created.customerTenant || created.customerRef || "Standard Client"}</strong>
            </div>
            <div className="result-detail-item">
              <span className="label">Reseller / Dealer</span>
              <strong>{created.dealer ? created.dealer.dealerName || created.dealer.username : "Direct Admin"}</strong>
            </div>
            <div className="result-detail-item">
              <span className="label">Expiration</span>
              <strong>{created.expiresAt ? new Date(created.expiresAt).toLocaleDateString() : "Perpetual"}</strong>
            </div>
            <div className="result-detail-item">
              <span className="label">Auto-Delivery Over mTLS</span>
              <strong className={created.autoDelivered ? "text-success" : "text-warning"}>
                {created.autoDelivered ? "Dispatched to client socket" : "Client socket offline — manual delivery"}
              </strong>
            </div>
          </div>

          <div className="page-actions-bar">
            <button className="btn" onClick={() => setCreated(null)}>
              Issue Another License
            </button>
            <button className="btn primary" onClick={() => onDone("License generated successfully")}>
              Done
            </button>
          </div>
        </div>
      ) : (
        /* Form Page View */
        <form onSubmit={submit} className="page-form-layout">
          <div className="form-sections-grid">
            {/* Left Section: Client & Identity */}
            <div className="page-content-card">
              <div className="card-section-head">
                <Sparkles size={18} className="pink-icon" />
                <h3>Client & Application Identity</h3>
              </div>

              <div className="field-group">
                <label className="field-label">
                  Client Provisioning ID <span className="req">*</span>
                </label>
                <textarea
                  rows={3}
                  value={provisioningId}
                  onChange={(e) => setProvisioningId(e.target.value)}
                  placeholder="Paste KTX1… string copied from the client application"
                  className="mono"
                  required
                />
                <span className="field-help">
                  {resolving
                    ? "Attesting client provisioning payload…"
                    : resolvedProduct
                      ? `Matched application: ${resolvedProduct.name} (${resolvedProduct.modules.length} modules loaded)`
                      : "The provisioning string securely provides the application HWID, application UUID, and supported modules."}
                </span>
                {provisioningError && <div className="form-error-banner">{provisioningError}</div>}
              </div>

              <div className="field-group">
                <label className="field-label">Resolved Application & Vendor</label>
                <input
                  readOnly
                  value={
                    resolvedProduct
                      ? `${resolvedProduct.tenant.name} · ${resolvedProduct.name} (${resolvedProduct.code})`
                      : "Waiting for valid client provisioning ID…"
                  }
                  className="readonly-input"
                />
                {resolvedProduct && (
                  <span className="field-help mono">
                    Vendor ID: {resolvedProduct.tenant.publicId} · App ID: {resolvedProduct.publicId}
                  </span>
                )}
              </div>

              <div className="field-row-2">
                <div className="field-group">
                  <label className="field-label">Customer Name</label>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. John Doe / Lead Tech"
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Customer Email</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="customer@enterprise.com"
                  />
                </div>
              </div>

              <div className="field-row-2">
                <div className="field-group">
                  <label className="field-label">Customer Tenant / Organization ID</label>
                  <input
                    value={customerTenant}
                    onChange={(e) => setCustomerTenant(e.target.value)}
                    placeholder="e.g. TENANT-CORP-01"
                  />
                  <span className="field-help">Distinct tenant ID for multi-vendor customer separation</span>
                </div>

                {!isDealer && (
                  <div className="field-group">
                    <label className="field-label">Assigned Dealer / Franchise</label>
                    <select
                      value={selectedDealerId}
                      onChange={(e) => setSelectedDealerId(e.target.value)}
                      className="corporate-select"
                    >
                      <option value="">Direct Admin (No Dealer)</option>
                      {dealers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.dealerName || d.username} ({d.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Right Section: Activation & Entitlements */}
            <div className="page-content-card">
              <div className="card-section-head">
                <KeyRound size={18} className="pink-icon" />
                <h3>Activation Policy & Duration</h3>
              </div>

              <div className="field-row-2">
                <div className="field-group">
                  <label className="field-label">Expiration Date</label>
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                  <span className="field-help">Leave empty for perpetual validity</span>
                </div>

                <div className="field-group">
                  <label className="field-label">Maximum Allowed Seats / HWIDs</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={maxActivations}
                    onChange={(e) => setMaxActivations(Math.max(1, Number(e.target.value) || 1))}
                  />
                </div>
              </div>

              <div className="field-group">
                <label className="checkbox-row-card">
                  <input
                    type="checkbox"
                    checked={autoActivate}
                    onChange={(e) => setAutoActivate(e.target.checked)}
                  />
                  <div>
                    <strong>Auto-Deliver Over Secure mTLS Connection</strong>
                    <p>If the client installation is currently connected over TLS, deliver the cryptographic key immediately.</p>
                  </div>
                </label>
              </div>

              {/* Module & Capability Entitlements */}
              <div className="entitlements-selector-box">
                <div className="entitlements-box-head">
                  <Cpu size={16} />
                  <strong>Application Modules & Capabilities</strong>
                </div>

                {capabilities.length > 0 ? (
                  <div className="capabilities-grid">
                    {capabilities.map((cap) => (
                      <div key={cap.code} className="capability-card">
                        {cap.type === "integer" ? (
                          <div className="capability-int-row">
                            <div>
                              <strong>{cap.code}</strong>
                              <small>{cap.name}</small>
                            </div>
                            <input
                              type="number"
                              min={cap.min ?? 0}
                              max={cap.max ?? 1000000}
                              value={Number(entitlements[cap.code] ?? cap.defaultValue ?? 0)}
                              onChange={(e) =>
                                setEntitlements((prev) => ({
                                  ...prev,
                                  [cap.code]: Number(e.target.value) || 0,
                                }))
                              }
                              className="cap-number-input"
                            />
                          </div>
                        ) : (
                          <label className="capability-bool-label">
                            <input
                              type="checkbox"
                              checked={entitlements[cap.code] === true}
                              onChange={(e) =>
                                setEntitlements((prev) => ({
                                  ...prev,
                                  [cap.code]: e.target.checked,
                                }))
                              }
                            />
                            <div>
                              <strong>{cap.code}</strong>
                              <small>{cap.name}</small>
                            </div>
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-subtext">
                    Paste a client provisioning ID to load specific certified capabilities.
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && <div className="form-error-banner">{error}</div>}

          {/* Form Bottom Actions */}
          <div className="page-actions-bar">
            <button type="button" className="btn" onClick={onBack}>
              Cancel
            </button>
            <button type="submit" className="btn primary glow-btn" disabled={loading || resolving}>
              <KeyRound size={16} />
              <span>{loading ? "Generating Cryptographic Key…" : "Generate & Sign License"}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
