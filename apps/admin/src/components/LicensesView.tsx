import { useState, useMemo } from "react";
import {
  AppWindow,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  Filter,
  KeyRound,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Store,
  Trash2,
  X,
} from "lucide-react";
import type { License } from "../types";

export function LicensesView({
  licenses,
  search,
  setSearch,
  onCreate,
  canManage,
  onEditModules,
  onExtend,
  onStatus,
  onDelete,
  onViewDetails,
  initialFilter = "ALL",
}: {
  licenses: License[];
  search: string;
  setSearch: (s: string) => void;
  onCreate: () => void;
  canManage: boolean;
  onEditModules: (l: License) => void;
  onExtend: (l: License) => void;
  onStatus: (id: string, s: string) => void;
  onDelete: (license: License) => void;
  onViewDetails: (l: License) => void;
  initialFilter?: string;
}) {
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter);
  const [appFilter, setAppFilter] = useState<string>("ALL");
  const [vendorFilter, setVendorFilter] = useState<string>("ALL");
  const [dealerFilter, setDealerFilter] = useState<string>("ALL");
  const [groupingMode, setGroupingMode] = useState<"flat" | "app" | "vendor">("flat");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const pageSize = 12;

  // Extract unique applications
  const uniqueApps = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of licenses) {
      if (l.product) map.set(l.product.id, l.product.name);
    }
    return Array.from(map.entries());
  }, [licenses]);

  // Extract unique vendors
  const uniqueVendors = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of licenses) {
      if (l.product?.tenant) map.set(l.product.tenant.id, l.product.tenant.name);
    }
    return Array.from(map.entries());
  }, [licenses]);

  // Extract unique dealers
  const uniqueDealers = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of licenses) {
      if (l.dealer) map.set(l.dealer.id, l.dealer.dealerName || l.dealer.username);
    }
    return Array.from(map.entries());
  }, [licenses]);

  // Filter licenses by search, status, app, vendor, and dealer
  const filteredLicenses = useMemo(() => {
    return licenses.filter((l) => {
      // Status Filter
      if (statusFilter === "ACTIVE" && l.status !== "ACTIVE") return false;
      if (statusFilter === "REVOKED" && l.status !== "REVOKED") return false;
      if (statusFilter === "EXPIRED") {
        if (!l.expiresAt) return false;
        const isExp = new Date(l.expiresAt).getTime() < Date.now();
        if (!isExp) return false;
      }

      // Application filter
      if (appFilter !== "ALL" && l.product?.id !== appFilter) return false;

      // Vendor filter
      if (vendorFilter !== "ALL" && l.product?.tenant?.id !== vendorFilter) return false;

      // Dealer filter
      if (dealerFilter !== "ALL") {
        if (dealerFilter === "DIRECT" && l.dealerId) return false;
        if (dealerFilter !== "DIRECT" && l.dealerId !== dealerFilter) return false;
      }

      // Search Query
      if (!search.trim()) return true;
      const query = search.toLowerCase();
      const haystack = [
        l.serial,
        l.customerRef ?? "",
        l.customerTenant ?? "",
        l.metadata?.customerName ?? "",
        l.metadata?.customerEmail ?? "",
        l.dealer?.dealerName ?? "",
        l.dealer?.username ?? "",
        l.product?.name ?? "",
        l.product?.code ?? "",
        l.product?.tenant?.name ?? "",
        l.product?.tenant?.code ?? "",
        ...l.modules.map((m) => m.module.code),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [licenses, search, statusFilter, appFilter, vendorFilter, dealerFilter]);

  // Grouping by Application
  const groupedByApp = useMemo(() => {
    const map = new Map<string, { appName: string; vendorName: string; appCode: string; licenses: License[] }>();
    for (const lic of filteredLicenses) {
      const key = lic.product?.id || "unknown";
      if (!map.has(key)) {
        map.set(key, {
          appName: lic.product?.name || "Unknown Application",
          vendorName: lic.product?.tenant?.name || "Unknown Vendor",
          appCode: lic.product?.code || "APP",
          licenses: [],
        });
      }
      map.get(key)!.licenses.push(lic);
    }
    return Array.from(map.entries());
  }, [filteredLicenses]);

  // Grouping by Vendor
  const groupedByVendor = useMemo(() => {
    const map = new Map<string, { vendorName: string; vendorCode: string; licenses: License[] }>();
    for (const lic of filteredLicenses) {
      const key = lic.product?.tenant?.id || "unknown";
      if (!map.has(key)) {
        map.set(key, {
          vendorName: lic.product?.tenant?.name || "Global / Unassigned",
          vendorCode: lic.product?.tenant?.code || "VENDOR",
          licenses: [],
        });
      }
      map.get(key)!.licenses.push(lic);
    }
    return Array.from(map.entries());
  }, [filteredLicenses]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const copySerial = (serial: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(serial);
    setCopiedId(serial);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Pagination for Flat View
  const totalPages = Math.max(1, Math.ceil(filteredLicenses.length / pageSize));
  const paginatedLicenses = filteredLicenses.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="view-container">
      {/* Top Toolbar */}
      <div className="view-toolbar">
        {/* Search */}
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by serial, customer, tenant, application, dealer, or module…"
          />
          {search && (
            <button className="clear-search-btn" onClick={() => setSearch("")}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Application Filter */}
        {uniqueApps.length > 0 && (
          <div className="filter-dropdown-wrap">
            <span className="control-label">Application:</span>
            <select
              value={appFilter}
              onChange={(e) => {
                setAppFilter(e.target.value);
                setPage(1);
              }}
              className="corporate-select"
            >
              <option value="ALL">All Applications ({uniqueApps.length})</option>
              {uniqueApps.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Vendor Filter */}
        {uniqueVendors.length > 0 && (
          <div className="filter-dropdown-wrap">
            <span className="control-label">Vendor:</span>
            <select
              value={vendorFilter}
              onChange={(e) => {
                setVendorFilter(e.target.value);
                setPage(1);
              }}
              className="corporate-select"
            >
              <option value="ALL">All Vendors ({uniqueVendors.length})</option>
              {uniqueVendors.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Dealer Filter */}
        {uniqueDealers.length > 0 && (
          <div className="filter-dropdown-wrap">
            <span className="control-label">Dealer:</span>
            <select
              value={dealerFilter}
              onChange={(e) => {
                setDealerFilter(e.target.value);
                setPage(1);
              }}
              className="corporate-select"
            >
              <option value="ALL">All Dealers ({uniqueDealers.length})</option>
              <option value="DIRECT">Direct Admin Only</option>
              {uniqueDealers.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Grouping Mode Selector */}
        <div className="group-toggle-wrap">
          <span className="control-label">Group By:</span>
          <div className="segmented-control">
            <button
              className={groupingMode === "flat" ? "active" : ""}
              onClick={() => setGroupingMode("flat")}
            >
              Flat View
            </button>
            <button
              className={groupingMode === "app" ? "active" : ""}
              onClick={() => {
                setGroupingMode("app");
                const all: Record<string, boolean> = {};
                groupedByApp.forEach(([k]) => {
                  all[k] = true;
                });
                setExpandedGroups(all);
              }}
            >
              Application
            </button>
            <button
              className={groupingMode === "vendor" ? "active" : ""}
              onClick={() => {
                setGroupingMode("vendor");
                const all: Record<string, boolean> = {};
                groupedByVendor.forEach(([k]) => {
                  all[k] = true;
                });
                setExpandedGroups(all);
              }}
            >
              Vendor
            </button>
          </div>
        </div>

        {/* Action Button */}
        {canManage && (
          <button className="btn primary glow-btn" onClick={onCreate}>
            <Plus size={16} />
            <span>Issue New License</span>
          </button>
        )}
      </div>

      {/* Filter Tabs Strip */}
      <div className="filter-tabs-strip">
        <button
          className={`filter-tab ${statusFilter === "ALL" ? "active" : ""}`}
          onClick={() => {
            setStatusFilter("ALL");
            setPage(1);
          }}
        >
          All Licenses ({licenses.length})
        </button>
        <button
          className={`filter-tab ${statusFilter === "ACTIVE" ? "active" : ""}`}
          onClick={() => {
            setStatusFilter("ACTIVE");
            setPage(1);
          }}
        >
          <span className="dot dot-success" /> Active ({licenses.filter((l) => l.status === "ACTIVE").length})
        </button>
        <button
          className={`filter-tab ${statusFilter === "REVOKED" ? "active" : ""}`}
          onClick={() => {
            setStatusFilter("REVOKED");
            setPage(1);
          }}
        >
          <span className="dot dot-danger" /> Revoked ({licenses.filter((l) => l.status === "REVOKED").length})
        </button>
        <button
          className={`filter-tab ${statusFilter === "EXPIRED" ? "active" : ""}`}
          onClick={() => {
            setStatusFilter("EXPIRED");
            setPage(1);
          }}
        >
          <span className="dot dot-warning" /> Expired (
          {licenses.filter((l) => l.expiresAt && new Date(l.expiresAt).getTime() < Date.now()).length})
        </button>
      </div>

      {/* VIEW 1: Grouped by Application */}
      {groupingMode === "app" && (
        <div className="grouped-accordion-container">
          {groupedByApp.map(([appId, group]) => {
            const isExpanded = expandedGroups[appId] ?? true;
            const activeInGroup = group.licenses.filter((l) => l.status === "ACTIVE").length;

            return (
              <div key={appId} className="accordion-card">
                <div className="accordion-header" onClick={() => toggleGroup(appId)}>
                  <div className="accordion-left">
                    <div className="product-icon">
                      <AppWindow size={18} />
                    </div>
                    <div>
                      <div className="accordion-title">
                        <strong>{group.appName}</strong>
                        <span className="mono app-code-pill">{group.appCode}</span>
                      </div>
                      <span className="accordion-subtitle">Vendor: {group.vendorName}</span>
                    </div>
                  </div>

                  <div className="accordion-right">
                    <div className="group-counts">
                      <span className="badge active">{activeInGroup} Active</span>
                      <span className="badge slate">{group.licenses.length} Total Licenses</span>
                    </div>
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="accordion-body">
                    <div className="table-wrap">
                      <table className="corporate-table">
                        <thead>
                          <tr>
                            <th>License Serial</th>
                            <th>Customer / Tenant</th>
                            <th>Dealer / Franchise</th>
                            <th>Seats</th>
                            <th>Expiration</th>
                            <th>Status</th>
                            <th style={{ textAlign: "right" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.licenses.map((lic) => (
                            <LicenseRow
                              key={lic.id}
                              license={lic}
                              canManage={canManage}
                              copiedId={copiedId}
                              onCopy={copySerial}
                              onViewDetails={onViewDetails}
                              onEditModules={onEditModules}
                              onExtend={onExtend}
                              onStatus={onStatus}
                              onDelete={onDelete}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {!groupedByApp.length && (
            <div className="empty-view">No licenses match the current search or filter.</div>
          )}
        </div>
      )}

      {/* VIEW 2: Grouped by Vendor */}
      {groupingMode === "vendor" && (
        <div className="grouped-accordion-container">
          {groupedByVendor.map(([vendorId, group]) => {
            const isExpanded = expandedGroups[vendorId] ?? true;
            const activeInGroup = group.licenses.filter((l) => l.status === "ACTIVE").length;

            return (
              <div key={vendorId} className="accordion-card">
                <div className="accordion-header" onClick={() => toggleGroup(vendorId)}>
                  <div className="accordion-left">
                    <div className="product-icon">
                      <Building2 size={18} />
                    </div>
                    <div>
                      <div className="accordion-title">
                        <strong>{group.vendorName}</strong>
                        <span className="mono app-code-pill">{group.vendorCode}</span>
                      </div>
                      <span className="accordion-subtitle">Tenant Namespace</span>
                    </div>
                  </div>

                  <div className="accordion-right">
                    <div className="group-counts">
                      <span className="badge active">{activeInGroup} Active</span>
                      <span className="badge slate">{group.licenses.length} Total Licenses</span>
                    </div>
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="accordion-body">
                    <div className="table-wrap">
                      <table className="corporate-table">
                        <thead>
                          <tr>
                            <th>License Serial</th>
                            <th>Customer / Tenant</th>
                            <th>Application</th>
                            <th>Dealer</th>
                            <th>Seats</th>
                            <th>Expiration</th>
                            <th>Status</th>
                            <th style={{ textAlign: "right" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.licenses.map((lic) => (
                            <LicenseRow
                              key={lic.id}
                              license={lic}
                              canManage={canManage}
                              copiedId={copiedId}
                              onCopy={copySerial}
                              onViewDetails={onViewDetails}
                              onEditModules={onEditModules}
                              onExtend={onExtend}
                              onStatus={onStatus}
                              onDelete={onDelete}
                              showApp
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {!groupedByVendor.length && (
            <div className="empty-view">No licenses match the current filter.</div>
          )}
        </div>
      )}

      {/* VIEW 3: Flat Sortable Corporate Data Table */}
      {groupingMode === "flat" && (
        <div className="panel table-panel">
          <div className="table-wrap">
            <table className="corporate-table">
              <thead>
                <tr>
                  <th>License Serial</th>
                  <th>Customer / Tenant</th>
                  <th>Vendor & Application</th>
                  <th>Dealer / Reseller</th>
                  <th>Seats</th>
                  <th>Expiration</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLicenses.map((lic) => (
                  <LicenseRow
                    key={lic.id}
                    license={lic}
                    canManage={canManage}
                    copiedId={copiedId}
                    onCopy={copySerial}
                    onViewDetails={onViewDetails}
                    onEditModules={onEditModules}
                    onExtend={onExtend}
                    onStatus={onStatus}
                    onDelete={onDelete}
                    showVendor
                    showApp
                  />
                ))}
              </tbody>
            </table>
            {!filteredLicenses.length && (
              <div className="empty-view">No licenses match this search or filter.</div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="corporate-pagination">
              <span>
                Showing {(page - 1) * pageSize + 1}–
                {Math.min(page * pageSize, filteredLicenses.length)} of {filteredLicenses.length} licenses
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
      )}
    </div>
  );
}

function LicenseRow({
  license,
  canManage,
  copiedId,
  onCopy,
  onViewDetails,
  onEditModules,
  onExtend,
  onStatus,
  onDelete,
  showVendor = false,
  showApp = false,
}: {
  license: License;
  canManage: boolean;
  copiedId: string | null;
  onCopy: (serial: string, e: React.MouseEvent) => void;
  onViewDetails: (l: License) => void;
  onEditModules: (l: License) => void;
  onExtend: (l: License) => void;
  onStatus: (id: string, s: string) => void;
  onDelete: (license: License) => void;
  showVendor?: boolean;
  showApp?: boolean;
}) {
  const isCopied = copiedId === license.serial;
  const isExp = license.expiresAt && new Date(license.expiresAt).getTime() < Date.now();
  const effectiveStatus = isExp && license.status === "ACTIVE" ? "EXPIRED" : license.status;

  return (
    <tr key={license.id} onClick={() => onViewDetails(license)} className="clickable-row">
      <td data-label="License">
        <div className="serial-cell">
          <strong className="mono pink-text license-serial font-bold">{license.serial}</strong>
          <button
            className="copy-icon-btn"
            onClick={(e) => onCopy(license.serial, e)}
            title="Copy serial"
          >
            <Copy size={13} />
            {isCopied && <span className="copied-tooltip">Copied!</span>}
          </button>
        </div>
        <span className="sub-detail">
          v{license.entitlementVersion} · {new Date(license.createdAt).toLocaleDateString()}
        </span>
      </td>

      <td data-label="Customer">
        <strong>
          {license.customerTenant || license.metadata?.customerName || license.customerRef || "Standard Client"}
        </strong>
        <span className="sub-detail">
          {license.metadata?.customerEmail || (license.customerTenant ? `Tenant: ${license.customerTenant}` : "No email")}
        </span>
      </td>

      {(showVendor || showApp) && (
        <td data-label="Application">
          {showVendor && <strong className="block-line">{license.product?.tenant?.name}</strong>}
          {showApp && <span>{license.product?.name}</span>}
        </td>
      )}

      <td data-label="Dealer">
        {license.dealer ? (
          <span className="badge slate">{license.dealer.dealerName || license.dealer.username}</span>
        ) : (
          <span className="sub-detail">Direct Admin</span>
        )}
      </td>

      <td data-label="Seats">
        <span className="seat-badge">
          {license.activations.length} / {license.maxActivations}
        </span>
      </td>

      <td data-label="Expiration">
        <span className={isExp ? "text-danger font-bold" : ""}>
          {license.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : "Perpetual"}
        </span>
      </td>

      <td data-label="Status">
        <span className={`badge ${effectiveStatus.toLowerCase()}`}>{effectiveStatus}</span>
      </td>

      <td data-label="Actions" onClick={(e) => e.stopPropagation()}>
        <div className="row-action-buttons">
          <button
            className="btn action-btn"
            onClick={() => onViewDetails(license)}
            title="View complete license specification"
          >
            <Eye size={14} /> Details
          </button>

          {canManage && (
            <button
              className="btn action-btn"
              onClick={() => onExtend(license)}
              title="Extend expiration date"
            >
              <Calendar size={14} /> Extend
            </button>
          )}

          {canManage && (
            <button
              className="btn action-btn"
              onClick={() => onEditModules(license)}
              title="Edit module capabilities & reissue key"
            >
              <RefreshCw size={14} /> Reissue
            </button>
          )}

          {canManage &&
            (license.status === "ACTIVE" ? (
              <button
                className="btn action-btn text-danger"
                onClick={() => onStatus(license.id, "REVOKED")}
                title="Revoke active license"
              >
                Revoke
              </button>
            ) : (
              <button
                className="btn action-btn"
                onClick={() => onStatus(license.id, "ACTIVE")}
                title="Restore license to active"
              >
                Restore
              </button>
            ))}

          {canManage && (
            <button
              className="btn action-btn icon-only text-danger"
              onClick={() => onDelete(license)}
              title="Delete license permanently"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
