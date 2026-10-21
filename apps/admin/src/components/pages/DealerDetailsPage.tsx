import { useState } from "react";
import {
  AppWindow,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  Store,
  Trash2,
  Users,
} from "lucide-react";
import { api } from "../../lib/api";
import type { Dealer, Product } from "../../types";

export function DealerDetailsPage({
  dealer,
  products,
  canManage,
  onBack,
  onDone,
}: {
  dealer: Dealer;
  products: Product[];
  canManage: boolean;
  onBack: () => void;
  onDone: (msg: string) => void;
}) {
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(
    dealer.dealerProducts?.map((dp) => dp.product.id) || [],
  );
  const [newPassword, setNewPassword] = useState("");
  const [isActive, setIsActive] = useState(dealer.isActive);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  async function saveChanges() {
    setLoading(true);
    setError("");
    try {
      await api(`/dealers/${dealer.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          isActive,
          allowedProductIds: selectedProductIds,
          password: newPassword.trim() || undefined,
        }),
      });
      onDone(`Dealer '${dealer.dealerName}' updated successfully`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
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
              <span className="current">{dealer.dealerName || dealer.username}</span>
            </div>
            <div className="title-with-badge">
              <h2>{dealer.dealerName || dealer.username}</h2>
              <span className={`badge ${dealer.role.toLowerCase()}`}>{dealer.role}</span>
              <span className={`badge ${isActive ? "active" : "revoked"}`}>
                {isActive ? "ACTIVE" : "SUSPENDED"}
              </span>
            </div>
          </div>
        </div>

        {canManage && (
          <div className="header-action-group">
            <button
              className={`btn action-btn ${isActive ? "text-danger" : "primary"}`}
              onClick={() => setIsActive(!isActive)}
            >
              {isActive ? "Suspend Dealer" : "Activate Dealer"}
            </button>
          </div>
        )}
      </div>

      <div className="page-two-col-layout">
        <div className="page-col-main">
          {/* Identity Card */}
          <div className="page-content-card">
            <h3 className="section-title">Reseller Account Specifications</h3>
            <div className="details-property-grid">
              <div className="prop-item">
                <span className="prop-label">Login Username</span>
                <span className="mono pink-text font-bold">{dealer.username}</span>
              </div>

              <div className="prop-item">
                <span className="prop-label">Reseller Organization</span>
                <span className="prop-value">{dealer.dealerName || "—"}</span>
              </div>

              <div className="prop-item">
                <span className="prop-label">Contact Email</span>
                <span className="prop-value">{dealer.dealerEmail || "Not specified"}</span>
              </div>

              <div className="prop-item">
                <span className="prop-label">Phone</span>
                <span className="prop-value">{dealer.dealerPhone || "Not specified"}</span>
              </div>

              <div className="prop-item">
                <span className="prop-label">Contract Notes</span>
                <span className="prop-value">{dealer.notes || "Standard partner agreement."}</span>
              </div>

              <div className="prop-item">
                <span className="prop-label">Partner Account Created</span>
                <span className="prop-value">{new Date(dealer.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Assigned Products Management */}
          <div className="page-content-card">
            <div className="card-section-head">
              <ShieldCheck size={18} className="pink-icon" />
              <div>
                <h3>Assigned Applications ({selectedProductIds.length} / {products.length})</h3>
                <p className="card-subtext">Check the applications this reseller is permitted to issue and reactivate.</p>
              </div>
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
                      disabled={!canManage}
                    />
                    <div>
                      <div className="app-select-title">
                        <strong>{p.name}</strong>
                        <span className="mono app-code-pill">{p.code}</span>
                      </div>
                      <small className="muted">Vendor: {p.tenant?.name}</small>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Reset Password Form for Dealer */}
          {canManage && (
            <div className="page-content-card">
              <div className="card-section-head">
                <KeyRound size={18} className="pink-icon" />
                <h3>Reset Dealer Password</h3>
              </div>
              <div className="field-group">
                <label className="field-label">New Password (Leave empty to keep current)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter at least 8 characters to reset password"
                />
              </div>
            </div>
          )}

          {error && <div className="form-error-banner">{error}</div>}

          {canManage && (
            <div className="page-actions-bar">
              <button className="btn" onClick={onBack}>Cancel</button>
              <button className="btn primary glow-btn" onClick={saveChanges} disabled={loading}>
                <CheckCircle2 size={16} />
                <span>{loading ? "Saving…" : "Save Dealer Permissions"}</span>
              </button>
            </div>
          )}
        </div>

        {/* Stats Column */}
        <div className="page-col-side">
          <div className="page-content-card">
            <h3 className="section-title">Reseller Telemetry</h3>
            <div className="stats-vertical-stack">
              <div className="stat-box-card">
                <span className="label">Allowed Products</span>
                <strong className="pink-text">{selectedProductIds.length}</strong>
              </div>
              <div className="stat-box-card">
                <span className="label">Licenses Issued</span>
                <strong>{dealer._count?.dealerLicenses || 0}</strong>
              </div>
              <div className="stat-box-card">
                <span className="label">Reseller Status</span>
                <span className={`badge ${isActive ? "active" : "revoked"}`}>
                  {isActive ? "ACTIVE" : "SUSPENDED"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
