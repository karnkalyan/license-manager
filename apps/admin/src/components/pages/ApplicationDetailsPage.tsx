import { useState } from "react";
import {
  AppWindow,
  ArrowLeft,
  Building2,
  Copy,
  Cpu,
  KeyRound,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Activation, License, Product } from "../../types";

export function ApplicationDetailsPage({
  product,
  licenses,
  clients,
  canManage,
  onBack,
  onIssueLicense,
}: {
  product: Product;
  licenses: License[];
  clients: Activation[];
  canManage: boolean;
  onBack: () => void;
  onIssueLicense: (p: Product) => void;
}) {
  const [copiedId, setCopiedId] = useState(false);

  const copyPublicId = () => {
    navigator.clipboard.writeText(product.publicId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const appLicenses = licenses.filter((l) => l.product?.id === product.id);
  const activeLicenses = appLicenses.filter((l) => l.status === "ACTIVE").length;
  const appClients = clients.filter((c) => c.license?.product?.publicId === product.publicId);
  const onlineClients = appClients.filter((c) => c.socketOnline).length;

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
              <span className="current">{product.name}</span>
            </div>
            <div className="title-with-badge">
              <h2>{product.name}</h2>
              <span className="mono app-code-pill">{product.code}</span>
            </div>
          </div>
        </div>

        {canManage && (
          <button className="btn primary glow-btn" onClick={() => onIssueLicense(product)}>
            <KeyRound size={16} />
            <span>Issue License For App</span>
          </button>
        )}
      </div>

      <div className="page-two-col-layout">
        <div className="page-col-main">
          {/* Main Info Card */}
          <div className="page-content-card">
            <h3 className="section-title">Application Specification</h3>
            <div className="details-property-grid">
              <div className="prop-item">
                <span className="prop-label">Application Public UUID</span>
                <div className="copyable-prop">
                  <span className="mono pink-text">{product.publicId}</span>
                  <button className="btn icon-btn mini-copy" onClick={copyPublicId} title="Copy UUID">
                    <Copy size={13} />
                    {copiedId && <span className="mini-tooltip">Copied</span>}
                  </button>
                </div>
              </div>

              <div className="prop-item">
                <span className="prop-label">Vendor Organization</span>
                <span className="prop-value font-bold">{product.tenant?.name || "Global Tenant"}</span>
              </div>

              <div className="prop-item">
                <span className="prop-label">Vendor Namespace UUID</span>
                <span className="mono prop-value">{product.tenant?.publicId}</span>
              </div>

              <div className="prop-item">
                <span className="prop-label">Description</span>
                <span className="prop-value">{product.description || "Enterprise application software."}</span>
              </div>
            </div>
          </div>

          {/* Modules Card */}
          <div className="page-content-card">
            <div className="card-section-head">
              <Cpu size={18} className="pink-icon" />
              <h3>Certified Modules ({product.modules.length})</h3>
            </div>

            {product.modules.length > 0 ? (
              <div className="chips-detailed-grid">
                {product.modules.map((m) => (
                  <div key={m.id} className="entitlement-pill-card">
                    <span className="mono code">{m.code}</span>
                    <span className="val-badge">{m.name}</span>
                    {m.description && <p className="module-desc-sub">{m.description}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-subtext">
                No modules registered yet. Modules are automatically discovered when a client installation connects.
              </div>
            )}
          </div>

          {/* Licenses for this Application */}
          <div className="page-content-card">
            <div className="card-section-head">
              <KeyRound size={18} className="pink-icon" />
              <h3>Associated Licenses ({appLicenses.length})</h3>
            </div>

            {appLicenses.length > 0 ? (
              <div className="table-wrap">
                <table className="corporate-table">
                  <thead>
                    <tr>
                      <th>Serial</th>
                      <th>Customer</th>
                      <th>Seats</th>
                      <th>Status</th>
                      <th>Expiration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appLicenses.slice(0, 10).map((l) => (
                      <tr key={l.id}>
                        <td><span className="mono pink-text font-bold">{l.serial}</span></td>
                        <td>{l.customerTenant || l.customerRef || "Standard Client"}</td>
                        <td><span className="mono">{l.activations.length} / {l.maxActivations}</span></td>
                        <td><span className={`badge ${l.status.toLowerCase()}`}>{l.status}</span></td>
                        <td>{l.expiresAt ? new Date(l.expiresAt).toLocaleDateString() : "Perpetual"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-subtext">No licenses issued for this application yet.</div>
            )}
          </div>
        </div>

        {/* Stats Sidebar */}
        <div className="page-col-side">
          <div className="page-content-card">
            <h3 className="section-title">Telemetry & Usage</h3>
            <div className="stats-vertical-stack">
              <div className="stat-box-card">
                <span className="label">Active Licenses</span>
                <strong className="text-success">{activeLicenses} <small>/ {appLicenses.length}</small></strong>
              </div>
              <div className="stat-box-card">
                <span className="label">Online Clients</span>
                <strong className={onlineClients > 0 ? "text-success" : ""}>
                  {onlineClients} <small>/ {appClients.length}</small>
                </strong>
              </div>
              <div className="stat-box-card">
                <span className="label">Client Modules</span>
                <strong>{product.modules.length}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
