import { useState } from "react";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  KeyRound,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api } from "../../lib/api";
import type { License } from "../../types";

export function LicenseExtendPage({
  license,
  onBack,
  onDone,
}: {
  license: License;
  onBack: () => void;
  onDone: (message: string) => void;
}) {
  const [extensionMode, setExtensionMode] = useState<"days" | "date">("days");
  const [days, setDays] = useState(90);
  const [customDate, setCustomDate] = useState("");
  const [customerRef, setCustomerRef] = useState(license.customerRef || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<License | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Compute preview date
  const currentExpiryTime = license.expiresAt && new Date(license.expiresAt).getTime() > Date.now()
    ? new Date(license.expiresAt).getTime()
    : Date.now();
  const previewDate = new Date(currentExpiryTime + days * 24 * 60 * 60 * 1000);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload: { days?: number; expiresAt?: string; customerRef?: string } = {
        customerRef: customerRef.trim() || undefined,
      };
      if (extensionMode === "date") {
        if (!customDate) throw new Error("Select an expiration date");
        payload.expiresAt = new Date(customDate).toISOString();
      } else {
        payload.days = days;
      }

      const updated = await api<License>(`/licenses/${license.id}/extend`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setResult(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extend license validity");
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
              <span className="current">Extend Expiration</span>
            </div>
            <h2>Extend License Validity</h2>
          </div>
        </div>

        {result && (
          <button className="btn primary" onClick={() => onDone(`License extended successfully`)}>
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
              <h3>License Validity Extended Successfully</h3>
              <p>Serial: <strong className="mono pink-text">{license.serial}</strong></p>
            </div>
          </div>

          <div className="result-details-grid">
            <div className="result-detail-item">
              <span className="label">Previous Expiration</span>
              <strong>{license.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : "Perpetual"}</strong>
            </div>
            <div className="result-detail-item">
              <span className="label">New Expiration Date</span>
              <strong className="text-success">
                {result.expiresAt ? new Date(result.expiresAt).toLocaleDateString() : "Perpetual"}
              </strong>
            </div>
            <div className="result-detail-item">
              <span className="label">Entitlement Version</span>
              <strong className="mono">v{result.entitlementVersion}</strong>
            </div>
            <div className="result-detail-item">
              <span className="label">Client Auto-Sync</span>
              <strong className="text-success">Live push sent to connected clients</strong>
            </div>
          </div>

          {result.jwtKey && (
            <div className="license-key-display-box">
              <div className="key-box-head">
                <strong>New Signed Cryptographic Key Token</strong>
                <button className="btn action-btn key-copy-btn" onClick={copyJwt}>
                  <Copy size={14} />
                  <span>{copiedKey ? "Copied!" : "Copy Key"}</span>
                </button>
              </div>
              <textarea readOnly rows={5} value={result.jwtKey} className="mono key-textarea" />
            </div>
          )}

          <div className="page-actions-bar">
            <button className="btn primary" onClick={() => onDone("License expiration extended")}>
              Return to License Details
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="page-form-layout narrow-layout">
          <div className="page-content-card">
            <div className="card-section-head">
              <Calendar size={18} className="pink-icon" />
              <h3>Validity Extension Policy</h3>
            </div>

            <div className="info-callout-strip">
              <Clock size={16} />
              <span>
                Current Expiration:{" "}
                <strong>{license.expiresAt ? new Date(license.expiresAt).toLocaleString() : "Perpetual"}</strong>
                {license.expiresAt && new Date(license.expiresAt).getTime() < Date.now() && (
                  <span className="badge danger inline-badge">EXPIRED</span>
                )}
              </span>
            </div>

            <div className="field-group">
              <label className="field-label">Choose Extension Method</label>
              <div className="segmented-control full-width">
                <button
                  type="button"
                  className={extensionMode === "days" ? "active" : ""}
                  onClick={() => setExtensionMode("days")}
                >
                  Quick Duration Presets
                </button>
                <button
                  type="button"
                  className={extensionMode === "date" ? "active" : ""}
                  onClick={() => setExtensionMode("date")}
                >
                  Pick Exact Date
                </button>
              </div>
            </div>

            {extensionMode === "days" ? (
              <div className="field-group">
                <label className="field-label">Duration Preset</label>
                <div className="preset-buttons-grid">
                  {[30, 60, 90, 180, 365, 730].map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`preset-btn ${days === d ? "selected" : ""}`}
                      onClick={() => setDays(d)}
                    >
                      +{d} Days
                      <small>{d >= 365 ? `${d / 365} Year(s)` : `${Math.round(d / 30)} Month(s)`}</small>
                    </button>
                  ))}
                </div>

                <div className="preview-date-box">
                  <span className="label">Calculated New Expiration:</span>
                  <strong className="mono pink-text">{previewDate.toLocaleDateString()}</strong>
                </div>
              </div>
            ) : (
              <div className="field-group">
                <label className="field-label">Target Expiration Date <span className="req">*</span></label>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  required
                />
              </div>
            )}

            <div className="field-group">
              <label className="field-label">Customer / Organization Reference Note</label>
              <input
                value={customerRef}
                onChange={(e) => setCustomerRef(e.target.value)}
                placeholder="Optional customer name or invoice note"
              />
              <span className="field-help">All modules, hardware binding (HWID), and serial number remain identical.</span>
            </div>

            {error && <div className="form-error-banner">{error}</div>}

            <div className="page-actions-bar">
              <button type="button" className="btn" onClick={onBack}>
                Cancel
              </button>
              <button type="submit" className="btn primary glow-btn" disabled={loading}>
                <Sparkles size={16} />
                <span>{loading ? "Extending Validity…" : "Confirm Extension"}</span>
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
