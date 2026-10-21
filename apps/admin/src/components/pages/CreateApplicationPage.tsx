import { useState } from "react";
import { AppWindow, ArrowLeft, Building2, Plus, Sparkles } from "lucide-react";
import { api } from "../../lib/api";
import type { Tenant } from "../../types";

export function CreateApplicationPage({
  tenants,
  onBack,
  onCreated,
}: {
  tenants: Tenant[];
  onBack: () => void;
  onCreated: (msg: string) => void;
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
      onCreated("Application created successfully");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
      setLoading(false);
    }
  }

  return (
    <div className="page-view-container">
      <div className="page-header">
        <div className="page-header-back">
          <button className="btn icon-btn back-btn" onClick={onBack} title="Back to Applications">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="page-breadcrumbs">
              <span>Applications</span>
              <span className="sep">/</span>
              <span className="current">Register Application</span>
            </div>
            <h2>Register New Application</h2>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="page-form-layout narrow-layout">
        <div className="page-content-card">
          <div className="card-section-head">
            <AppWindow size={18} className="pink-icon" />
            <h3>Application Specification</h3>
          </div>

          <div className="field-group">
            <label className="field-label">
              Software Vendor / Publisher Organization <span className="req">*</span>
            </label>
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="corporate-select"
              required
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
            <span className="field-help">Vendor that owns and authors this software application</span>
          </div>

          <div className="field-row-2">
            <div className="field-group">
              <label className="field-label">
                Application Code <span className="req">*</span>
              </label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. BILLING_PRO"
                className="mono"
                required
              />
              <span className="field-help">Uppercase alphanumeric code</span>
            </div>

            <div className="field-group">
              <label className="field-label">
                Application Name <span className="req">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kashtrix Billing Pro"
                required
              />
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">Description / Scope</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enterprise capabilities, supported platforms, and documentation"
            />
          </div>

          {error && <div className="form-error-banner">{error}</div>}

          <div className="page-actions-bar">
            <button type="button" className="btn" onClick={onBack}>
              Cancel
            </button>
            <button type="submit" className="btn primary glow-btn" disabled={loading}>
              <Plus size={16} />
              <span>{loading ? "Registering…" : "Register Application"}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
