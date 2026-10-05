import { useState, useMemo } from "react";
import {
  FileClock,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCog,
  X,
} from "lucide-react";
import type { Audit, ManagedUser } from "../types";

export function UsersView({
  users,
  currentUserId,
  onCreate,
  onToggle,
  onDelete,
}: {
  users: ManagedUser[];
  currentUserId: string;
  onCreate: () => void;
  onToggle: (user: ManagedUser) => void;
  onDelete: (user: ManagedUser) => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        (u.tenant?.name || "").toLowerCase().includes(q),
    );
  }, [users, search]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const paginatedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);

  const formatRelative = (d?: string) => {
    if (!d) return "Never";
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
            placeholder="Search users by name, role, or vendor scope…"
          />
          {search && (
            <button className="clear-search-btn" onClick={() => setSearch("")}>
              <X size={14} />
            </button>
          )}
        </div>

        <button className="btn primary" onClick={onCreate}>
          <Plus size={16} />
          <span>Add System User</span>
        </button>
      </div>

      <div className="panel table-panel">
        <div className="table-wrap">
          <table className="corporate-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Role Assignment</th>
                <th>Vendor Scope</th>
                <th>Status</th>
                <th>Last Active</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map((user) => (
                <tr key={user.id}>
                  <td data-label="Username">
                    <strong>{user.username}</strong>
                    <span className="sub-detail">
                      Created {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </td>

                  <td data-label="Role">
                    <span className={`badge ${user.role.toLowerCase()}`}>
                      {user.role.replaceAll("_", " ")}
                    </span>
                  </td>

                  <td data-label="Vendor">
                    <strong>{user.tenant?.name ?? "Global / All Vendors"}</strong>
                    <span className="sub-detail">{user.tenant?.code ?? "Enterprise Scope"}</span>
                  </td>

                  <td data-label="Status">
                    <span className={`badge ${user.isActive ? "active" : "revoked"}`}>
                      {user.isActive ? "ACTIVE" : "SUSPENDED"}
                    </span>
                  </td>

                  <td data-label="Last Active">
                    <span>{formatRelative(user.lastLoginAt)}</span>
                  </td>

                  <td data-label="Actions">
                    <div className="row-action-buttons">
                      <button
                        className="btn action-btn"
                        disabled={user.id === currentUserId}
                        onClick={() => onToggle(user)}
                      >
                        {user.isActive ? "Disable" : "Enable"}
                      </button>
                      <button
                        className="btn action-btn text-danger icon-only"
                        disabled={user.id === currentUserId}
                        onClick={() => onDelete(user)}
                        title="Delete user"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!filteredUsers.length && (
            <div className="empty-view">
              <UserCog size={32} className="empty-icon" />
              <h3>No administrative users found</h3>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="corporate-pagination">
            <span>
              Showing {(page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, filteredUsers.length)} of{" "}
              {filteredUsers.length} users
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

export function AuditView({ rows }: { rows: Audit[] }) {
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const filteredAudits = useMemo(() => {
    return rows.filter((r) => {
      if (severityFilter !== "ALL" && r.severity !== severityFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        r.action.toLowerCase().includes(q) ||
        r.entityType.toLowerCase().includes(q) ||
        (r.actor?.username || "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, severityFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAudits.length / pageSize));
  const paginatedAudits = filteredAudits.slice((page - 1) * pageSize, page * pageSize);

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
            placeholder="Search audit trail by event action, entity, or actor username…"
          />
          {search && (
            <button className="clear-search-btn" onClick={() => setSearch("")}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="filter-dropdown-wrap">
          <span className="control-label">Severity:</span>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="corporate-select"
          >
            <option value="ALL">All Severities</option>
            <option value="INFO">Info</option>
            <option value="WARNING">Warning</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
      </div>

      <div className="panel table-panel">
        <div className="table-wrap">
          <table className="corporate-table">
            <thead>
              <tr>
                <th>Event Action</th>
                <th>Target Entity</th>
                <th>Triggered By</th>
                <th>Severity</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {paginatedAudits.map((r) => (
                <tr key={String(r.id)}>
                  <td data-label="Event">
                    <strong>{r.action.replaceAll("_", " ")}</strong>
                  </td>

                  <td data-label="Entity">
                    <span className="mono">{r.entityType}</span>
                  </td>

                  <td data-label="Actor">
                    <span>{r.actor?.username || "Automated System"}</span>
                  </td>

                  <td data-label="Severity">
                    <span className={`badge ${r.severity.toLowerCase()}`}>
                      {r.severity}
                    </span>
                  </td>

                  <td data-label="Time">
                    <span>{formatRelative(r.createdAt)}</span>
                    <small className="sub-detail">
                      {new Date(r.createdAt).toLocaleString()}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!filteredAudits.length && (
            <div className="empty-view">
              <FileClock size={32} className="empty-icon" />
              <h3>No audit entries recorded</h3>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="corporate-pagination">
            <span>
              Showing {(page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, filteredAudits.length)} of{" "}
              {filteredAudits.length} events
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
