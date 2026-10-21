import { useState } from "react";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Copy,
  Cpu,
  Eye,
  KeyRound,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import type { License } from "../../types";

export function LicenseDetailsPage({
  license,
  canManage,
  onBack,
  onEditModules,
  onExtend,
  onStatus,
  onDelete,
}: {
  license: License;
  canManage: boolean;
  onBack: () => void;
  onEditModules: (l: License) => void;
  onExtend: (l: License) => void;
  onStatus: (id: string, s: string) => void;
  onDelete: (l: License) => void;
}) {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSerial, setCopiedSerial] = useState(false);

  const copySerial = () => {
    navigator.clipboard.writeText(license.serial);
    setCopiedSerial(true);
    setTimeout(() => setCopiedSerial(false), 2000);
  };

  const copyJwt = () => {
    if (!license.jwtKey) return;
    navigator.clipboard.writeText(license.jwtKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const isExpired = license.expiresAt ? new Date(license.expiresAt).getTime() <= Date.now() : false;
  const effectiveStatus = isExpired && license.status === "ACTIVE" ? "EXPIRED" : license.status;
  const meta = (license.metadata && typeof license.metadata === "object" ? license.metadata : {}) as Record<string, any>;
  const entitlements = (meta.entitlements || {}) as Record<string, boolean | number>;

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
              <span className="current mono">{license.serial}</span>
            </div>
            <div className="title-with-badge">
              <h2>{license.serial}</h2>
              <span className={`badge ${effectiveStatus.toLowerCase()}`}>{effectiveStatus}</span>
            </div>
          </div>
        </div>

        <div className="header-action-group">
          {canManage && (
            <>
              <button className="btn action-btn" onClick={() => onExtend(license)} title="Extend validity date">
                <Calendar size={15} />
                <span>Extend Expiration</span>
              </button>

              <button className="btn action-btn" onClick={() => onEditModules(license)} title="Reissue capabilities">
                <RefreshCw size={15} />
                <span>Reissue Modules</span>
              </button>

              {license.status === "ACTIVE" ? (
                <button
                  className="btn action-btn text-danger"
                  onClick={() => onStatus(license.id, "REVOKED")}
                >
                  <ShieldAlert size={15} />
                  <span>Revoke</span>
                </button>
              ) : (
                <button
                  className="btn action-btn primary"
                  onClick={() => onStatus(license.id, "ACTIVE")}
                >
                  <ShieldCheck size={15} />
                  <span>Restore Active</span>
                </button>
              )}

              <button
                className="btn action-btn icon-only text-danger"
                onClick={() => onDelete(license)}
                title="Permanently delete license"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="page-two-col-layout">
        {/* Left Column: Specifications & Meta */}
        <div className="page-col-main">
          {/* Main Attributes Card */}
          <div className="page-content-card">
            <h3 className="section-title">License Attributes</h3>
            <div className="details-property-grid">
              <div className="prop-item">
                <span className="prop-label">Serial Number</span>
                <div className="copyable-prop">
                  <span className="mono pink-text font-bold">{license.serial}</span>
                  <button className="btn icon-btn mini-copy" onClick={copySerial} title="Copy serial">
                    <Copy size={13} />
                    {copiedSerial && <span className="mini-tooltip">Copied</span>}
                  </button>
                </div>
              </div>

              <div className="prop-item">
                <span className="prop-label">Customer Organization / Tenant</span>
                <span className="prop-value">
                  {license.customerTenant || license.customerRef || meta.customerName || "Standard Client"}
                </span>
              </div>

              <div className="prop-item">
                <span className="prop-label">Customer Contact</span>
                <span className="prop-value">
                  {meta.customerName || "—"} {meta.customerEmail ? `(${meta.customerEmail})` : ""}
                </span>
              </div>

              <div className="prop-item">
                <span className="prop-label">Reseller / Dealer</span>
                <span className="prop-value">
                  {license.dealer ? `${license.dealer.dealerName || license.dealer.username}` : "Direct Enterprise Admin"}
                </span>
              </div>

              <div className="prop-item">
                <span className="prop-label">Application</span>
                <span className="prop-value font-bold">{license.product.name} ({license.product.code})</span>
              </div>

              <div className="prop-item">
                <span className="prop-label">Vendor Namespace</span>
                <span className="prop-value">{license.product.tenant.name} ({license.product.tenant.code})</span>
              </div>

              <div className="prop-item">
                <span className="prop-label">Expiration Date</span>
                <span className={`prop-value ${isExpired ? "text-danger" : ""}`}>
                  {license.expiresAt ? new Date(license.expiresAt).toLocaleString() : "Perpetual Validity"}
                </span>
              </div>

              <div className="prop-item">
                <span className="prop-label">Entitlement Version</span>
                <span className="prop-value mono">v{license.entitlementVersion}</span>
              </div>

              <div className="prop-item">
                <span className="prop-label">Created At</span>
                <span className="prop-value">{new Date(license.createdAt).toLocaleString()}</span>
              </div>

              <div className="prop-item">
                <span className="prop-label">Seats Bound</span>
                <span className="prop-value mono">
                  {license.activations.length} / {license.maxActivations} Seats
                </span>
              </div>
            </div>
          </div>

          {/* Module Capabilities Card */}
          <div className="page-content-card">
            <div className="card-section-head">
              <Cpu size={18} className="pink-icon" />
              <h3>Certified Modules & Capabilities</h3>
            </div>

            <div className="chips-detailed-grid">
              {Object.keys(entitlements).length > 0 ? (
                Object.entries(entitlements).map(([code, val]) => {
                  const isBool = typeof val === "boolean";
                  const badgeClass = isBool
                    ? val
                      ? "val-enabled"
                      : "val-disabled"
                    : "val-quota";
                  return (
                    <div key={code} className="entitlement-pill-card">
                      <span className="mono code">{code}</span>
                      <span className={`val-badge ${badgeClass}`}>
                        {isBool ? (val ? "ENABLED" : "DISABLED") : String(val)}
                      </span>
                    </div>
                  );
                })
              ) : license.modules.length > 0 ? (
                license.modules.map((m) => (
                  <div key={m.module.id} className="entitlement-pill-card">
                    <span className="mono code">{m.module.code}</span>
                    <span className="val-badge val-enabled">{m.module.name || "ENABLED"}</span>
                  </div>
                ))
              ) : (
                <div className="empty-subtext">No individual module overrides (Default application scope)</div>
              )}
            </div>
          </div>

          {/* Connected Activations Card */}
          <div className="page-content-card">
            <div className="card-section-head">
              <Users size={18} className="pink-icon" />
              <h3>Hardware Activations ({license.activations.length} / {license.maxActivations})</h3>
            </div>

            {license.activations.length > 0 ? (
              <div className="table-wrap">
                <table className="corporate-table">
                  <thead>
                    <tr>
                      <th>Installation ID</th>
                      <th>Platform</th>
                      <th>Version</th>
                      <th>State</th>
                      <th>Last Heartbeat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {license.activations.map((a) => (
                      <tr key={a.id}>
                        <td><span className="mono">{a.clientId}</span></td>
                        <td>{a.platform || "Standard"}</td>
                        <td>{a.appVersion || "—"}</td>
                        <td><span className={`badge ${a.state.toLowerCase()}`}>{a.state}</span></td>
                        <td>{a.lastHeartbeatAt ? new Date(a.lastHeartbeatAt).toLocaleTimeString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-subtext">No client machines have activated with this license serial yet.</div>
            )}
          </div>
        </div>

        {/* Right Column: Key Enclave & Cryptography */}
        <div className="page-col-side">
          <div className="page-content-card sticky-card">
            <div className="card-section-head">
              <ShieldCheck size={18} className="pink-icon" />
              <h3>Signed Enclave Key</h3>
            </div>

            <p className="helper-text">
              Cryptographically signed token using Ed25519 signature scheme with HWID hardware attestation.
            </p>

            {license.jwtKey ? (
              <div className="jwt-key-box">
                <textarea readOnly rows={6} value={license.jwtKey} className="mono small-key-textarea" />
                <button className="btn primary action-btn full-width" onClick={copyJwt}>
                  <Copy size={14} />
                  <span>{copiedKey ? "Copied Key!" : "Copy Signed JWT"}</span>
                </button>
              </div>
            ) : (
              <div className="empty-subtext">
                Token key signature is sealed. Use Reissue Modules to generate a fresh exportable key token.
              </div>
            )}

            <div className="quick-actions-box">
              <span className="box-label">Quick Actions</span>
              <button className="btn full-width action-btn" onClick={() => onExtend(license)}>
                <Calendar size={15} />
                <span>Extend Expiration</span>
              </button>
              <button className="btn full-width action-btn" onClick={() => onEditModules(license)}>
                <RefreshCw size={15} />
                <span>Reissue Capabilities</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
