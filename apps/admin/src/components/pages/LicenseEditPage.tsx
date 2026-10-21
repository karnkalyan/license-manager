import { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Cpu,
  KeyRound,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { api } from "../../lib/api";
import type { Capability, License, Product } from "../../types";
import { initialEntitlements } from "./CreateLicensePage";

export function LicenseEditPage({
  license,
  onBack,
  onDone,
}: {
  license: License;
  onBack: () => void;
  onDone: (message: string) => void;
}) {
  const currentMeta = (license.metadata && typeof license.metadata === "object" ? license.metadata : {}) as Record<string, any>;
  const [provisioningId, setProvisioningId] = useState(currentMeta.provisioningId || "");
  const [capabilities, setCapabilities] = useState<Capability[]>(() => {
    return (license.product.modules || []).map((m) => ({
      code: m.code,
      name: m.name,
      description: m.description,
      type: "boolean" as const,
      defaultValue: false,
    }));
  });
  const [entitlements, setEntitlements] = useState<Record<string, boolean | number>>(() => {
    return (currentMeta.entitlements as Record<string, boolean | number>) || {};
  });
  const [customerName, setCustomerName] = useState(currentMeta.customerName || license.customerRef || "");
  const [customerEmail, setCustomerEmail] = useState(currentMeta.customerEmail || "");
  const [expiresAt, setExpiresAt] = useState(
    license.expiresAt ? new Date(license.expiresAt).toISOString().split("T")[0] : "",
  );
  const [autoActivate, setAutoActivate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<License | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [capSearch, setCapSearch] = useState("");

  const filteredCapabilities = useMemo(() => {
    if (!capSearch.trim()) return capabilities;
    const q = capSearch.toLowerCase();
    return capabilities.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        (c.name && c.name.toLowerCase().includes(q))
    );
  }, [capabilities, capSearch]);

  useEffect(() => {
    const value = provisioningId.trim();
    if (!value || !value.startsWith("KTX1.")) return;

    const timer = window.setTimeout(async () => {
      setResolving(true);
      try {
        const res = await api<{
          product: Product;
          capabilities: Capability[];
        }>("/applications/resolve-provisioning", {
          method: "POST",
          body: JSON.stringify({ provisioningId: value }),
        });
        if (res.product.id !== license.product.id) {
          setError("Warning: Provisioning ID is for a different application");
          return;
        }
        setCapabilities(res.capabilities);
        setEntitlements(initialEntitlements(res.capabilities, entitlements));
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Lookup failed");
      } finally {
        setResolving(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [provisioningId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const updated = await api<License>(`/licenses/${license.id}/modules`, {
        method: "POST",
        body: JSON.stringify({
          provisioningId: provisioningId.trim() || undefined,
          entitlements,
          customerName: customerName.trim() || undefined,
          customerEmail: customerEmail.trim() || undefined,
          expiresAt: expiresAt || undefined,
          autoActivate,
        }),
      });
      setResult(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reissue failed");
    } finally {
      setLoading(false);
    }
  }

  const copyJwt = () => {
    if (!result?.jwtKey) return;
    navigator.clipboard.writeText(result.jwtKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="page-view-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-back">
          <button className="btn icon-btn back-btn" onClick={onBack} title="Back">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="page-breadcrumbs">
              <span>Licenses</span>
              <span className="sep">/</span>
              <span className="mono">{license.serial}</span>
              <span className="sep">/</span>
              <span className="current">Reissue Capabilities</span>
            </div>
            <h2>Reissue License & Adjust Modules</h2>
          </div>
        </div>

        {result && (
          <button className="btn primary" onClick={() => onDone("Capabilities reissued")}>
            <CheckCircle2 size={16} />
            <span>Finish & Return</span>
          </button>
        )}
      </div>

      {result ? (
        <div className="page-content-card result-card">
          <div className="result-header-badge">
            <div className="result-badge-icon">
              <ShieldCheck size={32} />
            </div>
            <div>
              <h3>License Capabilities Reissued (Version {result.entitlementVersion})</h3>
              <p>Serial: <strong className="mono pink-text">{license.serial}</strong></p>
            </div>
          </div>

          <div className="license-key-display-box">
            <div className="key-box-head">
              <strong>Newly Generated Cryptographic Token</strong>
              <button className="btn action-btn key-copy-btn" onClick={copyJwt}>
                <Copy size={14} />
                <span>{copiedKey ? "Copied!" : "Copy Key"}</span>
              </button>
            </div>
            <textarea readOnly rows={5} value={result.jwtKey || ""} className="mono key-textarea" />
          </div>

          <div className="page-actions-bar">
            <button className="btn primary" onClick={() => onDone("License reissued")}>
              Return to License Details
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="page-form-layout">
          <div className="form-sections-grid">
            <div className="page-content-card">
              <div className="card-section-head">
                <RefreshCw size={18} className="pink-icon" />
                <h3>Client Configuration & Customer</h3>
              </div>

              <div className="field-group">
                <label className="field-label">Update Client Provisioning ID (Optional)</label>
                <textarea
                  rows={2}
                  value={provisioningId}
                  onChange={(e) => setProvisioningId(e.target.value)}
                  placeholder="Paste fresh KTX1 string if client regenerated ID"
                  className="mono"
                />
                <span className="field-help">Keeps hardware binding synchronized if updated</span>
              </div>

              <div className="field-row-2">
                <div className="field-group">
                  <label className="field-label">Customer Name</label>
                  <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </div>
                <div className="field-group">
                  <label className="field-label">Customer Email</label>
                  <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
                </div>
              </div>

              <div className="field-group">
                <label className="field-label">Expiration Date</label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>

              <div className="field-group">
                <label className="checkbox-row-card">
                  <input
                    type="checkbox"
                    checked={autoActivate}
                    onChange={(e) => setAutoActivate(e.target.checked)}
                  />
                  <div>
                    <strong>Auto-Deliver Over Active Socket</strong>
                    <p>Pushes the newly signed replacement key directly to connected client sessions.</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="page-content-card">
              <div className="card-section-head" style={{ justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Cpu size={18} className="pink-icon" />
                  <h3>Module Capability Toggles</h3>
                  {capabilities.length > 0 && (
                    <span className="badge slate" style={{ marginLeft: "6px" }}>
                      {capabilities.length} Total
                    </span>
                  )}
                </div>
                {capabilities.length > 5 && (
                  <div style={{ position: "relative", width: "180px" }}>
                    <input
                      type="text"
                      placeholder="Search modules..."
                      value={capSearch}
                      onChange={(e) => setCapSearch(e.target.value)}
                      style={{
                        minHeight: "30px",
                        height: "30px",
                        padding: "0 8px 0 26px",
                        fontSize: "12px",
                        borderRadius: "6px",
                      }}
                    />
                    <Search
                      size={13}
                      style={{
                        position: "absolute",
                        left: "8px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "var(--muted)",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="capabilities-grid">
                {filteredCapabilities.map((cap) => {
                  const isBool = cap.type !== "integer";
                  const isChecked = entitlements[cap.code] === true;
                  return (
                    <div
                      key={cap.code}
                      className={`capability-card ${isBool && isChecked ? "active-bool" : ""}`}
                    >
                      {cap.type === "integer" ? (
                        <div className="capability-int-row">
                          <div>
                            <strong>{cap.code}</strong>
                            <small>{cap.name || "Numeric allocation quota"}</small>
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
                            checked={isChecked}
                            onChange={(e) =>
                              setEntitlements((prev) => ({
                                ...prev,
                                [cap.code]: e.target.checked,
                              }))
                            }
                          />
                          <div>
                            <strong>{cap.code}</strong>
                            <small>{cap.name || "Toggle feature access"}</small>
                          </div>
                        </label>
                      )}
                    </div>
                  );
                })}
                {filteredCapabilities.length === 0 && (
                  <div className="empty-subtext" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "16px" }}>
                    No modules match "{capSearch}"
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && <div className="form-error-banner">{error}</div>}

          <div className="page-actions-bar">
            <button type="button" className="btn" onClick={onBack}>
              Cancel
            </button>
            <button type="submit" className="btn primary glow-btn" disabled={loading || resolving}>
              <KeyRound size={16} />
              <span>{loading ? "Reissuing Token…" : "Reissue & Sign Replacement Key"}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
