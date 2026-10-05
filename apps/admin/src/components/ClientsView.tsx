import { useState, useMemo } from "react";
import {
  Activity,
  AlertOctagon,
  Copy,
  Cpu,
  Eye,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import type { Activation } from "../types";

export function ClientsView({
  clients,
  canSupport,
  canManage,
  onBan,
  onRevalidate,
  onViewDetails,
  initialFilter = "ALL",
}: {
  clients: Activation[];
  canSupport: boolean;
  canManage: boolean;
  onBan: (c: Activation) => void;
  onRevalidate: (c: Activation) => void;
  onViewDetails: (c: Activation) => void;
  initialFilter?: string;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialFilter);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      if (statusFilter === "ONLINE" && !c.socketOnline) return false;
      if (statusFilter === "WAITING" && !c.provisioningOnline) return false;
      if (statusFilter === "BANNED" && c.state !== "BANNED") return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const haystack = [
        c.clientId,
        c.platform || "",
        c.appVersion || "",
        c.license?.serial || "",
        c.license?.product?.name || "",
        c.license?.product?.tenant?.name || "",
        c.state,
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [clients, search, statusFilter]);

  const copyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const paginatedClients = filteredClients.slice((page - 1) * pageSize, page * pageSize);

  const formatRelative = (d?: string) => {
    if (!d) return "—";
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div className="view-container">
      <div className="view-toolbar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by client ID, platform, application, or license serial…"
          />
          {search && (
            <button className="clear-search-btn" onClick={() => setSearch("")}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="filter-tabs-strip inline-strip">
          <button
            className={`filter-tab ${statusFilter === "ALL" ? "active" : ""}`}
            onClick={() => { setStatusFilter("ALL"); setPage(1); }}
          >
            All Clients ({clients.length})
          </button>
          <button
            className={`filter-tab ${statusFilter === "ONLINE" ? "active" : ""}`}
            onClick={() => { setStatusFilter("ONLINE"); setPage(1); }}
          >
            <span className="dot dot-success" /> Online ({clients.filter((c) => c.socketOnline).length})
          </button>
          <button
            className={`filter-tab ${statusFilter === "WAITING" ? "active" : ""}`}
            onClick={() => { setStatusFilter("WAITING"); setPage(1); }}
          >
            <span className="dot dot-warning" /> Revalidation Needed
          </button>
          <button
            className={`filter-tab ${statusFilter === "BANNED" ? "active" : ""}`}
            onClick={() => { setStatusFilter("BANNED"); setPage(1); }}
          >
            <span className="dot dot-danger" /> Banned ({clients.filter((c) => c.state === "BANNED").length})
          </button>
        </div>
      </div>

      <div className="panel table-panel">
        <div className="table-wrap">
          <table className="corporate-table">
            <thead>
              <tr>
                <th>Client Installation ID</th>
                <th>Application & Vendor</th>
                <th>Associated License</th>
                <th>Modules</th>
                <th>Status</th>
                <th>Last Heartbeat</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedClients.map((c) => {
                const isCopied = copiedId === c.clientId;
                return (
                  <tr
                    key={c.id}
                    onClick={() => onViewDetails(c)}
                    className="clickable-row"
                  >
                    <td data-label="Client ID">
                      <div className="serial-cell">
                        <strong className="mono client-id-text">{c.clientId}</strong>
                        <button
                          className="copy-icon-btn"
                          onClick={(e) => copyId(c.clientId, e)}
                          title="Copy client ID"
                        >
                          <Copy size={13} />
                          {isCopied && <span className="copied-tooltip">Copied!</span>}
                        </button>
                      </div>
                      <span className="sub-detail">
                        {c.platform || "Platform Unknown"} · v{c.appVersion || "1.0.0"}
                      </span>
                    </td>

                    <td data-label="Application">
                      <strong>{c.license?.product?.name}</strong>
                      <span className="sub-detail">{c.license?.product?.tenant?.name}</span>
                    </td>

                    <td data-label="License">
                      <span className="mono serial-sub">{c.license?.serial}</span>
                      <span className="sub-detail">
                        {c.license?.status === "ACTIVE" ? "Valid Key" : c.license?.status}
                      </span>
                    </td>

                    <td data-label="Modules">
                      <div className="chips">
                        {c.license?.modules.map((m) => (
                          <span className="chip" key={m.module.id}>
                            {m.module.code}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td data-label="Status">
                      <span
                        className={`badge ${c.socketOnline ? "online" : c.state.toLowerCase()}`}
                      >
                        {c.socketOnline ? "ONLINE" : c.state}
                      </span>
                    </td>

                    <td data-label="Heartbeat">
                      <span>{formatRelative(c.lastHeartbeatAt)}</span>
                    </td>

                    <td data-label="Actions" onClick={(e) => e.stopPropagation()}>
                      <div className="row-action-buttons">
                        <button
                          className="btn action-btn"
                          onClick={() => onViewDetails(c)}
                          title="View client hardware details"
                        >
                          <Eye size={14} /> Details
                        </button>

                        {canSupport && (
                          <button
                            className="btn action-btn"
                            onClick={() => onRevalidate(c)}
                            title="Trigger signed client revalidation"
                          >
                            <ShieldCheck size={14} /> Revalidate
                          </button>
                        )}

                        {canManage && (
                          <button
                            className={`btn action-btn ${c.state === "BANNED" ? "" : "text-danger"}`}
                            onClick={() => onBan(c)}
                            title={c.state === "BANNED" ? "Unban installation" : "Ban installation"}
                          >
                            {c.state === "BANNED" ? "Unban" : "Ban"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!filteredClients.length && (
            <div className="empty-view">
              <Cpu size={32} className="empty-icon" />
              <h3>No client installations found</h3>
              <p>Clients will appear here once connected via mTLS.</p>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="corporate-pagination">
            <span>
              Showing {(page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, filteredClients.length)} of{" "}
              {filteredClients.length} clients
            </span>
            <div className="pagination-buttons">
              <button
                className="btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span className="page-indicator">
                Page {page} of {totalPages}
              </span>
              <button
                className="btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
