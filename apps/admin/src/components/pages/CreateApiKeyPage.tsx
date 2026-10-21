import { useState } from "react";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Copy,
  Globe,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api } from "../../lib/api";
import type { ApiKey, Dealer, SessionUser } from "../../types";

export function CreateApiKeyPage({
  dealers,
  session,
  onBack,
  onCreated,
}: {
  dealers: Dealer[];
  session: SessionUser | null;
  onBack: () => void;
  onCreated: (msg: string) => void;
}) {
  const isDealer = session?.role === "DEALER" || session?.role === "FRANCHISE";

  const [name, setName] = useState("");
  const [durationDays, setDurationDays] = useState(90);
  const [allowedDomains, setAllowedDomains] = useState("*");
  const [role, setRole] = useState<"READ_EXTEND" | "READ_ONLY" | "FULL">("READ_EXTEND");
  const [selectedDealerId, setSelectedDealerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ApiKey | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const created = await api<ApiKey>("/api-keys", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          durationDays,
          allowedDomains: allowedDomains.trim() || "*",
          role,
          dealerId: isDealer ? session?.id : selectedDealerId || undefined,
        }),
      });
      setResult(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate API Key");
    } finally {
      setLoading(false);
    }
  }

  const copyKey = () => {
    if (!result?.key) return;
    navigator.clipboard.writeText(result.key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="page-view-container">
      <div className="page-header">
        <div className="page-header-back">
          <button className="btn icon-btn back-btn" onClick={onBack} title="Back to API Keys">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="page-breadcrumbs">
              <span>API Key Enclave</span>
              <span className="sep">/</span>
              <span className="current">Generate Key</span>
            </div>
            <h2>Generate Duration-Based API Key</h2>
          </div>
        </div>

        {result && (
          <button className="btn primary" onClick={() => onCreated("API Key created successfully")}>
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
              <h3>API Key Generated (Standard KTX Enclave)</h3>
              <p>Key Name: <strong>{result.name}</strong></p>
            </div>
          </div>

          <div className="license-key-display-box">
            <div className="key-box-head">
              <strong>Cryptographic API Token (KTX_ Standard)</strong>
              <button className="btn action-btn key-copy-btn" onClick={copyKey}>
                <Copy size={14} />
                <span>{copiedKey ? "Copied!" : "Copy Key"}</span>
              </button>
            </div>
            <input readOnly value={result.key} className="mono key-single-input pink-text font-bold" />
            <small className="warning-text-note">
              Copy this token now. It authorizes programmatic access to review and extend licenses.
            </small>
          </div>

          <div className="result-details-grid">
            <div className="result-detail-item">
              <span className="label">Authorized Domains</span>
              <strong>{result.allowedDomains === "*" ? "All Domains (*)" : result.allowedDomains}</strong>
            </div>
            <div className="result-detail-item">
              <span className="label">Expiration Date</span>
              <strong className="text-success">{new Date(result.expiresAt).toLocaleDateString()}</strong>
            </div>
            <div className="result-detail-item">
              <span className="label">Permissions</span>
              <strong className="badge active">{result.role}</strong>
            </div>
            <div className="result-detail-item">
              <span className="label">Reseller / Dealer Scope</span>
              <strong>{result.dealer ? result.dealer.dealerName || result.dealer.username : "Global Admin"}</strong>
            </div>
          </div>

          <div className="page-actions-bar">
            <button className="btn primary" onClick={() => onCreated("API Key generated")}>
              Done & View All Keys
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="page-form-layout narrow-layout">
          <div className="page-content-card">
            <div className="card-section-head">
              <KeyRound size={18} className="pink-icon" />
              <h3>API Key Parameters</h3>
            </div>

            <div className="field-group">
              <label className="field-label">
                API Key Friendly Name <span className="req">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Partner Portal Integration / Storefront V2"
                required
              />
            </div>

            <div className="field-group">
              <label className="field-label">
                Authorized Domains (Domain Binding) <span className="req">*</span>
              </label>
              <input
                value={allowedDomains}
                onChange={(e) => setAllowedDomains(e.target.value)}
                placeholder="e.g. api.client.com, storefront.app or * for any domain"
                className="mono"
                required
              />
              <span className="field-help">
                Security constraint: Requests with this API key will be strictly rejected if dispatched from any domain
                not listed here. Enter comma-separated domains or <code>*</code> for open access.
              </span>
            </div>

            <div className="field-group">
              <label className="field-label">Key Duration & Validity Period</label>
              <div className="preset-buttons-grid">
                {[30, 60, 90, 180, 365].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`preset-btn ${durationDays === d ? "selected" : ""}`}
                    onClick={() => setDurationDays(d)}
                  >
                    {d} Days
                    <small>{d >= 365 ? "1 Year" : `${Math.round(d / 30)} Months`}</small>
                  </button>
                ))}
              </div>
              <span className="field-help">
                Key automatically expires and revokes access on{" "}
                <strong>{new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toLocaleDateString()}</strong>
              </span>
            </div>

            <div className="field-row-2">
              <div className="field-group">
                <label className="field-label">Permission Scope</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="corporate-select"
                >
                  <option value="READ_EXTEND">READ_EXTEND (Inspect all licenses & extend dates)</option>
                  <option value="READ_ONLY">READ_ONLY (View all license details only)</option>
                  <option value="FULL">FULL ACCESS</option>
                </select>
              </div>

              {!isDealer && (
                <div className="field-group">
                  <label className="field-label">Reseller / Dealer Scope</label>
                  <select
                    value={selectedDealerId}
                    onChange={(e) => setSelectedDealerId(e.target.value)}
                    className="corporate-select"
                  >
                    <option value="">Global Admin Key (All Data)</option>
                    {dealers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.dealerName || d.username} ({d.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {error && <div className="form-error-banner">{error}</div>}

            <div className="page-actions-bar">
              <button type="button" className="btn" onClick={onBack}>
                Cancel
              </button>
              <button type="submit" className="btn primary glow-btn" disabled={loading}>
                <Sparkles size={16} />
                <span>{loading ? "Generating KTX_ Key…" : "Generate API Key"}</span>
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
