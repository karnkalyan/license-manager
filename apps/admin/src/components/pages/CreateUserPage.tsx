import { useState } from "react";
import { ArrowLeft, Plus, ShieldCheck, UserCog } from "lucide-react";
import { api } from "../../lib/api";
import type { Tenant } from "../../types";

export function CreateUserPage({
  tenants,
  isSuperAdmin,
  onBack,
  onCreated,
}: {
  tenants: Tenant[];
  isSuperAdmin: boolean;
  onBack: () => void;
  onCreated: (msg: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("ADMIN");
  const [tenantId, setTenantId] = useState<string>(tenants[0]?.id || "");
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
          username: username.trim(),
          password,
          role,
          tenantId: role === "VENDOR" ? tenantId : undefined,
        }),
      });
      onCreated(`User ${username} created successfully`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "User creation failed");
      setLoading(false);
    }
  }

  return (
    <div className="page-view-container">
      <div className="page-header">
        <div className="page-header-back">
          <button className="btn icon-btn back-btn" onClick={onBack} title="Back to Users">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="page-breadcrumbs">
              <span>Users & Roles</span>
              <span className="sep">/</span>
              <span className="current">Create User</span>
            </div>
            <h2>Create System Administrator / Operator</h2>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="page-form-layout narrow-layout">
        <div className="page-content-card">
          <div className="card-section-head">
            <UserCog size={18} className="pink-icon" />
            <h3>User Account & Role Scope</h3>
          </div>

          <div className="field-row-2">
            <div className="field-group">
              <label className="field-label">
                Username <span className="req">*</span>
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. sec_admin"
                className="mono"
                required
              />
            </div>

            <div className="field-group">
              <label className="field-label">
                Initial Password <span className="req">*</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 12 characters"
                required
              />
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">System Role Assignment <span className="req">*</span></label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="corporate-select"
            >
              {isSuperAdmin && <option value="SUPER_ADMIN">Super Administrator (Full Cluster Access)</option>}
              <option value="ADMIN">Administrator (Operational Management)</option>
              <option value="SUPPORT">Support Specialist (Revalidate / Audit)</option>
              <option value="MONITORING">Monitoring / Telemetry Only</option>
              <option value="VENDOR">Vendor Scoped User</option>
              <option value="AUDITOR">Compliance Auditor (Read-Only Logs)</option>
            </select>
          </div>

          {role === "VENDOR" && (
            <div className="field-group">
              <label className="field-label">Assigned Vendor Scope <span className="req">*</span></label>
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
              <span className="field-help">User will be restricted strictly to this vendor's applications</span>
            </div>
          )}

          {error && <div className="form-error-banner">{error}</div>}

          <div className="page-actions-bar">
            <button type="button" className="btn" onClick={onBack}>
              Cancel
            </button>
            <button type="submit" className="btn primary glow-btn" disabled={loading}>
              <Plus size={16} />
              <span>{loading ? "Creating…" : "Create System User"}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
