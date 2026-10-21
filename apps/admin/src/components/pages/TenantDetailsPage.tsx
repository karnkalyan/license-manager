import { useState } from "react";
import {
  AppWindow,
  ArrowLeft,
  Building2,
  Copy,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import type { License, Product, Tenant } from "../../types";

export function TenantDetailsPage({
  tenant,
  products,
  licenses,
  canManage,
  onBack,
  onStatus,
}: {
  tenant: Tenant;
  products: Product[];
  licenses: License[];
  canManage: boolean;
  onBack: () => void;
  onStatus: (t: Tenant, s: string) => void;
}) {
  const [copiedId, setCopiedId] = useState(false);

  const copyPublicId = () => {
    navigator.clipboard.writeText(tenant.publicId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const vendorApps = products.filter((p) => p.tenant?.id === tenant.id);
  const vendorLicenses = licenses.filter((l) => l.product?.tenant?.id === tenant.id);
  const activeLicenses = vendorLicenses.filter((l) => l.status === "ACTIVE").length;

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
              <span className="current">{tenant.name}</span>
            </div>
            <div className="title-with-badge">
              <h2>{tenant.name}</h2>
              <span className="mono app-code-pill">{tenant.code}</span>
              <span className={`badge ${tenant.status.toLowerCase()}`}>{tenant.status}</span>
            </div>
          </div>
        </div>

        {canManage && (
          <button
            className={`btn action-btn ${tenant.status === "ACTIVE" ? "text-danger" : "primary"}`}
            onClick={() => onStatus(tenant, tenant.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE")}
          >
            {tenant.status === "ACTIVE" ? "Suspend Vendor" : "Activate Vendor"}
          </button>
        )}
      </div>

      <div className="page-two-col-layout">
        <div className="page-col-main">
          <div className="page-content-card">
            <h3 className="section-title">Namespace Specifications</h3>
            <div className="details-property-grid">
              <div className="prop-item">
                <span className="prop-label">Public Namespace UUID</span>
                <div className="copyable-prop">
                  <span className="mono pink-text">{tenant.publicId}</span>
                  <button className="btn icon-btn mini-copy" onClick={copyPublicId} title="Copy UUID">
                    <Copy size={13} />
                    {copiedId && <span className="mini-tooltip">Copied</span>}
                  </button>
                </div>
              </div>

              <div className="prop-item">
                <span className="prop-label">Vendor Code</span>
                <span className="mono prop-value">{tenant.code}</span>
              </div>

              <div className="prop-item">
                <span className="prop-label">Status</span>
                <span className={`badge ${tenant.status.toLowerCase()}`}>{tenant.status}</span>
              </div>

              <div className="prop-item">
                <span className="prop-label">Description</span>
                <span className="prop-value">{tenant.description || "Isolated multi-tenant vendor workspace."}</span>
              </div>
            </div>
          </div>

          {/* Applications under this vendor */}
          <div className="page-content-card">
            <div className="card-section-head">
              <AppWindow size={18} className="pink-icon" />
              <h3>Authored Applications ({vendorApps.length})</h3>
            </div>

            {vendorApps.length > 0 ? (
              <div className="table-wrap">
                <table className="corporate-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Code</th>
                      <th>Public UUID</th>
                      <th>Modules</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorApps.map((p) => (
                      <tr key={p.id}>
                        <td><strong>{p.name}</strong></td>
                        <td><span className="mono">{p.code}</span></td>
                        <td><span className="mono sub-detail">{p.publicId}</span></td>
                        <td>{p.modules.length} Modules</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-subtext">No applications created under this vendor yet.</div>
            )}
          </div>
        </div>

        <div className="page-col-side">
          <div className="page-content-card">
            <h3 className="section-title">Overview Stats</h3>
            <div className="stats-vertical-stack">
              <div className="stat-box-card">
                <span className="label">Applications</span>
                <strong>{vendorApps.length}</strong>
              </div>
              <div className="stat-box-card">
                <span className="label">Active Licenses</span>
                <strong className="text-success">{activeLicenses}</strong>
              </div>
              <div className="stat-box-card">
                <span className="label">Total Issued Licenses</span>
                <strong>{vendorLicenses.length}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
