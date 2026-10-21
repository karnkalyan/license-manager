import { useState, useMemo } from "react";
import {
  AppWindow,
  Eye,
  KeyRound,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Store,
  Users,
  X,
} from "lucide-react";
import type { Dealer, Product } from "../types";

export function DealersView({
  dealers,
  products,
  canManage,
  onCreate,
  onViewDetails,
  onToggleStatus,
}: {
  dealers: Dealer[];
  products: Product[];
  canManage: boolean;
  onCreate: () => void;
  onViewDetails: (d: Dealer) => void;
  onToggleStatus: (d: Dealer) => void;
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const filteredDealers = useMemo(() => {
    return dealers.filter((d) => {
      if (roleFilter !== "ALL" && d.role !== roleFilter) return false;
      if (statusFilter === "ACTIVE" && !d.isActive) return false;
      if (statusFilter === "SUSPENDED" && d.isActive) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const haystack = [
        d.username,
        d.dealerName,
        d.dealerEmail || "",
        d.dealerPhone || "",
        d.role,
        ...d.dealerProducts.map((dp) => dp.product.name),
        ...d.dealerProducts.map((dp) => dp.product.code),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [dealers, search, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredDealers.length / pageSize));
  const paginated = filteredDealers.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="view-container">
      {/* Top Toolbar */}
      <div className="view-toolbar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search dealers by name, username, contact, or assigned application…"
          />
          {search && (
            <button className="clear-search-btn" onClick={() => setSearch("")}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="filter-dropdown-wrap">
          <span className="control-label">Tier:</span>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="corporate-select"
          >
            <option value="ALL">All Tiers ({dealers.length})</option>
            <option value="DEALER">Dealers</option>
            <option value="FRANCHISE">Franchises</option>
          </select>
        </div>

        <div className="filter-dropdown-wrap">
          <span className="control-label">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="corporate-select"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>

        {canManage && (
          <button className="btn primary glow-btn" onClick={onCreate}>
            <Plus size={16} />
            <span>Add Dealer / Franchise</span>
          </button>
        )}
      </div>

      {/* Dealer Cards Grid */}
      <div className="tenant-cards-grid">
        {paginated.map((dealer) => {
          return (
            <div
              key={dealer.id}
              className="tenant-corporate-card clickable-card"
              onClick={() => onViewDetails(dealer)}
            >
              <div className="tenant-card-header">
                <div className="tenant-card-title-group">
                  <div className="product-icon">
                    <Store size={20} />
                  </div>
                  <div>
                    <h3>{dealer.dealerName || dealer.username}</h3>
                    <span className="mono tenant-code-pill">@{dealer.username}</span>
                  </div>
                </div>
                <div className="badges-row">
                  <span className={`badge ${dealer.role.toLowerCase()}`}>{dealer.role}</span>
                  <span className={`badge ${dealer.isActive ? "active" : "revoked"}`}>
                    {dealer.isActive ? "ACTIVE" : "SUSPENDED"}
                  </span>
                </div>
              </div>

              {dealer.dealerEmail && (
                <div className="dealer-contact-line">
                  <span className="sub-detail">{dealer.dealerEmail} {dealer.dealerPhone ? `· ${dealer.dealerPhone}` : ""}</span>
                </div>
              )}

              {/* Assigned Apps Strip */}
              <div className="app-modules-summary">
                <div className="modules-label-row">
                  <strong>Assigned Applications ({dealer.dealerProducts.length})</strong>
                  <span className="modules-status-text">Authorized to activate</span>
                </div>
                <div className="chips">
                  {dealer.dealerProducts.slice(0, 4).map((dp) => (
                    <span className="chip" key={dp.product.id}>
                      {dp.product.name}
                    </span>
                  ))}
                  {dealer.dealerProducts.length > 4 && (
                    <span className="chip-more">+{dealer.dealerProducts.length - 4} more</span>
                  )}
                  {!dealer.dealerProducts.length && (
                    <span className="text-warning text-xs">No products assigned yet</span>
                  )}
                </div>
              </div>

              {/* Stats Strip */}
              <div className="app-card-stats-strip">
                <div className="stat-col">
                  <span className="stat-label">Licenses Issued</span>
                  <strong className="pink-text">{dealer._count?.dealerLicenses || 0}</strong>
                </div>
                <div className="stat-col">
                  <span className="stat-label">Allowed Apps</span>
                  <strong>{dealer.dealerProducts.length}</strong>
                </div>
                <div className="stat-col">
                  <span className="stat-label">Partner Joined</span>
                  <strong>{new Date(dealer.createdAt).toLocaleDateString()}</strong>
                </div>
              </div>

              {/* Footer */}
              <div className="tenant-card-footer" onClick={(e) => e.stopPropagation()}>
                <button className="btn action-btn wide-btn" onClick={() => onViewDetails(dealer)}>
                  <Eye size={14} /> View Details & Permissions
                </button>
                {canManage && (
                  <button
                    className={`btn action-btn ${dealer.isActive ? "text-danger" : "primary"}`}
                    onClick={() => onToggleStatus(dealer)}
                  >
                    {dealer.isActive ? "Suspend" : "Activate"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!filteredDealers.length && (
        <div className="empty-view">
          <Store size={36} className="empty-icon" />
          <h3>No dealers found</h3>
          <p>Create a dealer or franchise account to empower resellers with isolated product activation rights.</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="corporate-pagination">
          <span>
            Showing {(page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, filteredDealers.length)} of {filteredDealers.length} dealers
          </span>
          <div className="pagination-buttons">
            <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span className="page-indicator">
              Page {page} of {totalPages}
            </span>
            <button className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
