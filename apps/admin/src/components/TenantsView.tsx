import { useState, useMemo } from "react";
import {
  AppWindow,
  Building2,
  Copy,
  Eye,
  KeyRound,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import type { License, Product, Tenant } from "../types";

export function TenantsView({
  tenants,
  products,
  licenses,
  canManage,
  onCreate,
  onStatus,
  onViewDetails,
}: {
  tenants: Tenant[];
  products: Product[];
  licenses: License[];
  canManage: boolean;
  onCreate: () => void;
  onStatus: (t: Tenant, status: string) => void;
  onViewDetails: (t: Tenant) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      if (statusFilter === "ACTIVE" && t.status !== "ACTIVE") return false;
      if (statusFilter === "SUSPENDED" && t.status !== "SUSPENDED") return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        t.publicId.toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q)
      );
    });
  }, [tenants, search, statusFilter]);

  const copyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="view-container">
      <div className="view-toolbar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors by organization name, code, or namespace UUID…"
          />
          {search && (
            <button className="clear-search-btn" onClick={() => setSearch("")}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="filter-dropdown-wrap">
          <span className="control-label">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="corporate-select"
          >
            <option value="ALL">All Statuses ({tenants.length})</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>

        {canManage && (
          <button className="btn primary" onClick={onCreate}>
            <Plus size={16} />
            <span>Add Vendor / Tenant</span>
          </button>
        )}
      </div>

      <div className="tenant-cards-grid">
        {filteredTenants.map((t) => {
          const vendorApps = products.filter((p) => p.tenant?.id === t.id);
          const vendorLicenses = licenses.filter((l) => l.product?.tenant?.id === t.id);
          const activeLicenses = vendorLicenses.filter((l) => l.status === "ACTIVE").length;
          const isCopied = copiedId === t.publicId;

          return (
            <div
              key={t.id}
              className="tenant-corporate-card"
              onClick={() => onViewDetails(t)}
            >
              <div className="tenant-card-header">
                <div className="tenant-card-title-group">
                  <div className="product-icon">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3>{t.name}</h3>
                    <span className="mono tenant-code-pill">{t.code}</span>
                  </div>
                </div>
                <span className={`badge ${t.status.toLowerCase()}`}>
                  {t.status}
                </span>
              </div>

              <div className="app-uuid-row">
                <span className="uuid-label">Namespace UUID:</span>
                <span className="mono uuid-val" title={t.publicId}>
                  {t.publicId}
                </span>
                <button
                  className="copy-mini-btn"
                  onClick={(e) => copyId(t.publicId, e)}
                  title="Copy UUID"
                >
                  <Copy size={12} />
                  {isCopied && <span className="copied-mini-tip">Copied</span>}
                </button>
              </div>

              <p className="tenant-description">
                {t.description || "Isolated multi-tenant vendor namespace."}
              </p>

              <div className="app-card-stats-strip">
                <div className="stat-col">
                  <span className="stat-label">Applications</span>
                  <strong>{vendorApps.length}</strong>
                </div>
                <div className="stat-col">
                  <span className="stat-label">Active Licenses</span>
                  <strong className="text-success">{activeLicenses}</strong>
                </div>
                <div className="stat-col">
                  <span className="stat-label">Total Issued</span>
                  <strong>{vendorLicenses.length}</strong>
                </div>
              </div>

              <div
                className="tenant-card-footer"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="btn action-btn wide-btn"
                  onClick={() => onViewDetails(t)}
                >
                  <Eye size={14} /> View Details
                </button>
                {canManage && (
                  <button
                    className={`btn action-btn ${t.status === "ACTIVE" ? "text-danger" : "primary"}`}
                    onClick={() =>
                      onStatus(t, t.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE")
                    }
                  >
                    {t.status === "ACTIVE" ? "Suspend" : "Activate"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!filteredTenants.length && (
        <div className="empty-view">
          <Building2 size={32} className="empty-icon" />
          <h3>No vendors match the filter</h3>
          <p>Create a vendor organization to set up isolated tenant workspaces.</p>
        </div>
      )}
    </div>
  );
}
