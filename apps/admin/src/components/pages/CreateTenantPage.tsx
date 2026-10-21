import { useState } from "react";
import { ArrowLeft, Building2, Plus } from "lucide-react";
import { api } from "../../lib/api";

export function CreateTenantPage({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: (msg: string) => void;
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
      onCreated("Vendor / tenant created successfully");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
      setLoading(false);
    }
  }

  return (
    <div className="page-view-container">
      <div className="page-header">
        <div className="page-header-back">
          <button className="btn icon-btn back-btn" onClick={onBack} title="Back to Vendors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="page-breadcrumbs">
              <span>Vendors & Tenants</span>
              <span className="sep">/</span>
              <span className="current">Create Vendor</span>
            </div>
            <h2>Create Software Vendor / Tenant</h2>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="page-form-layout narrow-layout">
        <div className="page-content-card">
          <div className="card-section-head">
            <Building2 size={18} className="pink-icon" />
            <h3>Vendor Organization Namespace</h3>
          </div>

          <div className="field-group">
            <label className="field-label">
              Vendor Code <span className="req">*</span>
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. KASHTRIX_V1"
              className="mono"
              required
            />
            <span className="field-help">Uppercase identifier code used for namespace segregation</span>
          </div>

          <div className="field-group">
            <label className="field-label">
              Organization Name <span className="req">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kashtrix Technology Labs"
              required
            />
          </div>

          <div className="field-group">
            <label className="field-label">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Vendor organization profile, contact, or licensing tier"
            />
          </div>

          {error && <div className="form-error-banner">{error}</div>}

          <div className="page-actions-bar">
            <button type="button" className="btn" onClick={onBack}>
              Cancel
            </button>
            <button type="submit" className="btn primary glow-btn" disabled={loading}>
              <Plus size={16} />
              <span>{loading ? "Creating…" : "Create Vendor Namespace"}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
