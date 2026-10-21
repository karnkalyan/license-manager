import { useState, useMemo } from "react";
import {
  BookOpen,
  Calendar,
  Check,
  Clock,
  Copy,
  Globe,
  KeyRound,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import type { ApiKey } from "../types";

export function ApiKeysView({
  apiKeys,
  canManage,
  onCreate,
  onViewDocs,
  onToggleStatus,
  onDelete,
}: {
  apiKeys: ApiKey[];
  canManage: boolean;
  onCreate: () => void;
  onViewDocs: () => void;
  onToggleStatus: (key: ApiKey) => void;
  onDelete: (key: ApiKey) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const now = Date.now();

  const filteredKeys = useMemo(() => {
    return apiKeys.filter((k) => {
      const isExp = new Date(k.expiresAt).getTime() <= now;
      if (statusFilter === "ACTIVE" && (!k.isActive || isExp)) return false;
      if (statusFilter === "EXPIRED" && !isExp) return false;
      if (statusFilter === "REVOKED" && k.isActive) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const haystack = [k.name, k.key, k.allowedDomains, k.role, k.dealer?.dealerName || ""].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [apiKeys, search, statusFilter, now]);

  const totalPages = Math.max(1, Math.ceil(filteredKeys.length / pageSize));
  const paginated = filteredKeys.slice((page - 1) * pageSize, page * pageSize);

  const copyKey = (key: ApiKey, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(key.key);
    setCopiedKeyId(key.id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

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
            placeholder="Search API keys by name, token, authorized domain, or dealer…"
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
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="corporate-select"
          >
            <option value="ALL">All Statuses ({apiKeys.length})</option>
            <option value="ACTIVE">Active & Valid</option>
            <option value="EXPIRED">Expired</option>
            <option value="REVOKED">Revoked / Suspended</option>
          </select>
        </div>

        <button className="btn action-btn" onClick={onViewDocs} title="View integration docs">
          <BookOpen size={16} />
          <span>API Documentation</span>
        </button>

        {canManage && (
          <button className="btn primary glow-btn" onClick={onCreate}>
            <Plus size={16} />
            <span>Generate API Key</span>
          </button>
        )}
      </div>

      {/* Keys Table Panel */}
      <div className="panel table-panel">
        <div className="table-wrap">
          <table className="corporate-table">
            <thead>
              <tr>
                <th>Key Friendly Name</th>
                <th>API Token (KTX_ Standard)</th>
                <th>Authorized Domains</th>
                <th>Permissions</th>
                <th>Expiration / Duration</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((k) => {
                const isExp = new Date(k.expiresAt).getTime() <= now;
                const daysLeft = Math.max(0, Math.ceil((new Date(k.expiresAt).getTime() - now) / (24 * 60 * 60 * 1000)));
                const isCopied = copiedKeyId === k.id;

                return (
                  <tr key={k.id}>
                    <td data-label="Name">
                      <strong>{k.name}</strong>
                      <span className="sub-detail">
                        {k.dealer ? `Scoped to Dealer: ${k.dealer.dealerName || k.dealer.username}` : "Global Admin Scope"}
                      </span>
                    </td>

                    <td data-label="Key">
                      <div className="key-token-display">
                        <span className="mono pink-text font-bold">
                          {k.key.slice(0, 8)}••••••••{k.key.slice(-4)}
                        </span>
                        <button
                          className="btn icon-btn mini-copy"
                          onClick={(e) => copyKey(k, e)}
                          title="Copy full key token"
                        >
                          <Copy size={13} />
                          {isCopied && <span className="mini-tooltip">Copied!</span>}
                        </button>
                      </div>
                    </td>

                    <td data-label="Domains">
                      <div className="domain-pill">
                        <Globe size={13} className="pink-icon" />
                        <span className="mono">{k.allowedDomains === "*" ? "All (*)" : k.allowedDomains}</span>
                      </div>
                    </td>

                    <td data-label="Role">
                      <span className="badge slate">{k.role}</span>
                    </td>

                    <td data-label="Expiration">
                      <div className="expiration-cell">
                        <span className={isExp ? "text-danger font-bold" : ""}>
                          {new Date(k.expiresAt).toLocaleDateString()}
                        </span>
                        <small className="sub-detail">
                          {isExp ? "Expired" : `${daysLeft} day(s) remaining`}
                        </small>
                      </div>
                    </td>

                    <td data-label="Status">
                      {isExp ? (
                        <span className="badge expired">EXPIRED</span>
                      ) : !k.isActive ? (
                        <span className="badge revoked">SUSPENDED</span>
                      ) : (
                        <span className="badge active">ACTIVE</span>
                      )}
                    </td>

                    <td data-label="Actions" style={{ textAlign: "right" }}>
                      <div className="row-action-buttons">
                        {canManage && (
                          <button
                            className={`btn action-btn ${k.isActive ? "text-danger" : "primary"}`}
                            onClick={() => onToggleStatus(k)}
                          >
                            {k.isActive ? "Disable" : "Enable"}
                          </button>
                        )}
                        {canManage && (
                          <button
                            className="btn action-btn icon-only text-danger"
                            onClick={() => onDelete(k)}
                            title="Delete API key permanently"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!filteredKeys.length && (
            <div className="empty-view">
              <KeyRound size={36} className="empty-icon" />
              <h3>No API keys found</h3>
              <p>Generate a duration-based API key with authorized domain binding to review and extend licenses via API.</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="corporate-pagination">
            <span>
              Showing {(page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, filteredKeys.length)} of {filteredKeys.length} API keys
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
    </div>
  );
}
