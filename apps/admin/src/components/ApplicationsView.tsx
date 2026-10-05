import { useState, useMemo } from "react";
import {
  AppWindow,
  Building2,
  Copy,
  Eye,
  KeyRound,
  Plus,
  Search,
  Sliders,
  X,
} from "lucide-react";
import type { Activation, License, Product } from "../types";

export function ApplicationsView({
  products,
  licenses,
  clients,
  canManage,
  onCreate,
  onViewDetails,
  onIssueLicense,
}: {
  products: Product[];
  licenses: License[];
  clients: Activation[];
  canManage: boolean;
  onCreate: () => void;
  onViewDetails: (product: Product) => void;
  onIssueLicense?: (product: Product) => void;
}) {
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Extract unique vendors for filter dropdown
  const vendors = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      if (p.tenant) {
        map.set(p.tenant.id, p.tenant.name);
      }
    }
    return Array.from(map.entries());
  }, [products]);

  // Filtered applications
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (vendorFilter !== "ALL" && p.tenant?.id !== vendorFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const haystack = [
        p.name,
        p.code,
        p.publicId,
        p.tenant?.name ?? "",
        p.tenant?.code ?? "",
        ...p.modules.map((m) => m.code),
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [products, search, vendorFilter]);

  const copyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="view-container">
      {/* Top Toolbar */}
      <div className="view-toolbar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search applications by name, code, module, or vendor…"
          />
          {search && (
            <button className="clear-search-btn" onClick={() => setSearch("")}>
              <X size={14} />
            </button>
          )}
        </div>

        {vendors.length > 0 && (
          <div className="filter-dropdown-wrap">
            <span className="control-label">Vendor:</span>
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="corporate-select"
            >
              <option value="ALL">All Vendors ({vendors.length})</option>
              {vendors.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}

        {canManage && (
          <button className="btn primary" onClick={onCreate}>
            <Plus size={16} />
            <span>Add Application</span>
          </button>
        )}
      </div>

      {/* Applications Grid */}
      <div className="application-cards-grid">
        {filteredProducts.map((p) => {
          const appLicenses = licenses.filter((l) => l.product?.id === p.id);
          const activeLicenses = appLicenses.filter((l) => l.status === "ACTIVE").length;
          const appClients = clients.filter((c) => c.license?.product?.publicId === p.publicId);
          const onlineClients = appClients.filter((c) => c.socketOnline).length;
          const isCopied = copiedId === p.publicId;

          return (
            <div
              key={p.id}
              className="app-corporate-card"
              onClick={() => onViewDetails(p)}
            >
              <div className="app-card-header">
                <div className="app-card-title-group">
                  <div className="product-icon">
                    <AppWindow size={20} />
                  </div>
                  <div>
                    <h3>{p.name}</h3>
                    <span className="app-vendor-tag">
                      <Building2 size={12} /> {p.tenant?.name || "Global Tenant"}
                    </span>
                  </div>
                </div>
                <span className="mono app-code-pill">{p.code}</span>
              </div>

              <div className="app-uuid-row">
                <span className="uuid-label">Application UUID:</span>
                <span className="mono uuid-val" title={p.publicId}>
                  {p.publicId}
                </span>
                <button
                  className="copy-mini-btn"
                  onClick={(e) => copyId(p.publicId, e)}
                  title="Copy UUID"
                >
                  <Copy size={12} />
                  {isCopied && <span className="copied-mini-tip">Copied</span>}
                </button>
              </div>

              {/* Module List Summary */}
              <div className="app-modules-summary">
                <div className="modules-label-row">
                  <strong>Client Modules ({p.modules.length})</strong>
                  <span className="modules-status-text">
                    {p.modules.length > 0 ? "Synchronized" : "Waiting Provisioning"}
                  </span>
                </div>
                <div className="chips">
                  {p.modules.slice(0, 6).map((m) => (
                    <span
                      className={`chip ${m.enabled ? "" : "disabled"}`}
                      key={m.id}
                    >
                      {m.code}
                    </span>
                  ))}
                  {p.modules.length > 6 && (
                    <span className="chip-more">+{p.modules.length - 6} more</span>
                  )}
                  {!p.modules.length && (
                    <span className="muted">Will register on client connection</span>
                  )}
                </div>
              </div>

              {/* Metrics Bar */}
              <div className="app-card-stats-strip">
                <div className="stat-col">
                  <span className="stat-label">Licenses</span>
                  <strong>
                    {activeLicenses} <small>/ {appLicenses.length}</small>
                  </strong>
                </div>
                <div className="stat-col">
                  <span className="stat-label">Connected Clients</span>
                  <strong className={onlineClients > 0 ? "text-success" : ""}>
                    {onlineClients} <small>/ {appClients.length}</small>
                  </strong>
                </div>
                <div className="stat-col">
                  <span className="stat-label">Capabilities</span>
                  <strong>{p.capabilities?.length || p.modules.length}</strong>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div
                className="app-card-footer"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="btn action-btn wide-btn"
                  onClick={() => onViewDetails(p)}
                >
                  <Eye size={14} /> View Specification
                </button>
                {canManage && (
                  <button
                    className="btn primary action-btn"
                    onClick={() => onIssueLicense?.(p)}
                    title="Issue license for this application"
                  >
                    <KeyRound size={14} /> Issue License
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!filteredProducts.length && (
        <div className="empty-view">
          <AppWindow size={32} className="empty-icon" />
          <h3>No applications found</h3>
          <p>Try adjusting your search criteria or add a new application.</p>
        </div>
      )}
    </div>
  );
}
