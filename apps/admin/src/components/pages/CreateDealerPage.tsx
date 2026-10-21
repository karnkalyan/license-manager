import { useState } from "react";
import { ArrowLeft, Check, Plus, ShieldCheck, Store } from "lucide-react";
import { api } from "../../lib/api";
import type { Product, Tenant } from "../../types";

export function CreateDealerPage({
  products,
  tenants,
  onBack,
  onCreated,
}: {
  products: Product[];
  tenants: Tenant[];
  onBack: () => void;
  onCreated: (msg: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [dealerName, setDealerName] = useState("");
  const [dealerPhone, setDealerPhone] = useState("");
  const [dealerEmail, setDealerEmail] = useState("");
  const [role, setRole] = useState<"DEALER" | "FRANCHISE">("DEALER");
  const [notes, setNotes] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const selectAllProducts = () => {
    if (selectedProductIds.length === products.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(products.map((p) => p.id));
    }
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProductIds.length) {
      setError("Please assign at least one allowed application/product to this dealer");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api("/dealers", {
        method: "POST",
        body: JSON.stringify({
          username: username.trim(),
          password,
          dealerName: dealerName.trim(),
          dealerPhone: dealerPhone.trim() || undefined,
          dealerEmail: dealerEmail.trim() || undefined,
          role,
          notes: notes.trim() || undefined,
          allowedProductIds: selectedProductIds,
        }),
      });
      onCreated(`Dealer / Franchise '${dealerName}' created successfully`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dealer creation failed");
      setLoading(false);
    }
  }

  return (
    <div className="page-view-container">
      <div className="page-header">
        <div className="page-header-back">
          <button className="btn icon-btn back-btn" onClick={onBack} title="Back to Dealers">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="page-breadcrumbs">
              <span>Dealers & Franchises</span>
              <span className="sep">/</span>
              <span className="current">Create Partner Account</span>
            </div>
            <h2>Create Dealer / Franchise Reseller</h2>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="page-form-layout">
        <div className="form-sections-grid">
          {/* Left Column: Account & Contact */}
          <div className="page-content-card">
            <div className="card-section-head">
              <Store size={18} className="pink-icon" />
              <h3>Partner Organization & Login Credentials</h3>
            </div>

            <div className="field-row-2">
              <div className="field-group">
                <label className="field-label">
                  Reseller / Franchise Name <span className="req">*</span>
                </label>
                <input
                  value={dealerName}
                  onChange={(e) => setDealerName(e.target.value)}
                  placeholder="e.g. Apex Software Solutions"
                  required
                />
              </div>

              <div className="field-group">
                <label className="field-label">Partner Tier Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="corporate-select"
                >
                  <option value="DEALER">Dealer / Reseller</option>
                  <option value="FRANCHISE">Exclusive Regional Franchise</option>
                </select>
              </div>
            </div>

            <div className="field-row-2">
              <div className="field-group">
                <label className="field-label">
                  Username (Login ID) <span className="req">*</span>
                </label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. apex_reseller"
                  className="mono"
                  required
                />
                <span className="field-help">Used to log in to the Dealer portal</span>
              </div>

              <div className="field-group">
                <label className="field-label">
                  Password <span className="req">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                />
              </div>
            </div>

            <div className="field-row-2">
              <div className="field-group">
                <label className="field-label">Official Contact Email</label>
                <input
                  type="email"
                  value={dealerEmail}
                  onChange={(e) => setDealerEmail(e.target.value)}
                  placeholder="partner@apexsolutions.com"
                />
              </div>

              <div className="field-group">
                <label className="field-label">Contact Phone</label>
                <input
                  value={dealerPhone}
                  onChange={(e) => setDealerPhone(e.target.value)}
                  placeholder="+1 (555) 019-2834"
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label">Internal Contract Notes</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Territory rights, commission structure, or legal agreement terms"
              />
            </div>
          </div>

          {/* Right Column: Allowed Applications Assignment */}
          <div className="page-content-card">
            <div className="card-section-head">
              <ShieldCheck size={18} className="pink-icon" />
              <div>
                <h3>Assigned Applications ({selectedProductIds.length} / {products.length})</h3>
                <p className="card-subtext">
                  Only assigned products can be activated, reactivated, or managed by this dealer.
                </p>
              </div>
            </div>

            <div className="select-all-row">
              <button type="button" className="btn action-btn" onClick={selectAllProducts}>
                {selectedProductIds.length === products.length ? "Deselect All" : "Select All Applications"}
              </button>
            </div>

            <div className="dealer-apps-assignment-list">
              {products.map((p) => {
                const checked = selectedProductIds.includes(p.id);
                return (
                  <label key={p.id} className={`checkbox-row-card ${checked ? "selected" : ""}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProduct(p.id)}
                    />
                    <div>
                      <div className="app-select-title">
                        <strong>{p.name}</strong>
                        <span className="mono app-code-pill">{p.code}</span>
                      </div>
                      <small className="muted">
                        Vendor: {p.tenant?.name} · {p.modules.length} Modules
                      </small>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {error && <div className="form-error-banner">{error}</div>}

        <div className="page-actions-bar">
          <button type="button" className="btn" onClick={onBack}>
            Cancel
          </button>
          <button type="submit" className="btn primary glow-btn" disabled={loading}>
            <Plus size={16} />
            <span>{loading ? "Creating Partner Account…" : "Create Dealer / Franchise"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
