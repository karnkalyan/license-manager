import {
  Activity,
  AlertTriangle,
  AppWindow,
  ArrowUpRight,
  Building2,
  Cpu,
  FileClock,
  KeyRound,
  ShieldCheck,
  Zap,
} from "lucide-react";
import type { Activation, Audit, Dashboard, License, Product, Tenant, View } from "../types";
import {
  ActivityLineChart,
  AppsDistributionChart,
  DonutChart,
  VendorDistributionChart,
} from "./Charts";

export function DashboardView({
  dash,
  clients,
  audits,
  tenants,
  products,
  licenses,
  onNavigate,
  onSelectClient,
}: {
  dash: Dashboard | null;
  clients: Activation[];
  audits: Audit[];
  tenants: Tenant[];
  products: Product[];
  licenses: License[];
  onNavigate: (view: View, filter?: string) => void;
  onSelectClient?: (client: Activation) => void;
}) {
  const activeCount = dash?.active ?? 0;
  const revokedCount = dash?.revoked ?? 0;
  const totalLicCount = dash?.licenses ?? licenses.length;
  const onlineCount = dash?.online ?? clients.filter((c) => c.socketOnline).length;
  const appsCount = products.length;
  const vendorsCount = tenants.length;

  return (
    <div className="dashboard-content">
      {/* Clickable Metric Widgets Grid */}
      <div className="metric-widgets-grid">
        {/* Total Online */}
        <div
          className="metric-card clickable"
          onClick={() => onNavigate("clients", "ONLINE")}
          title="Click to view online connected clients"
        >
          <div className="metric-top">
            <span className="metric-label">Total Online</span>
            <div className="metric-badge green">
              <span className="pulse-dot" /> LIVE
            </div>
          </div>
          <div className="metric-body">
            <strong className="metric-num">{onlineCount}</strong>
            <div className="metric-icon-wrap icon-green">
              <Activity size={20} />
            </div>
          </div>
          <div className="metric-footer">
            <span>Validated mTLS connections</span>
            <ArrowUpRight size={14} className="metric-arrow" />
          </div>
        </div>

        {/* Total Licenses */}
        <div
          className="metric-card clickable"
          onClick={() => onNavigate("licenses", "ALL")}
          title="Click to view all licenses"
        >
          <div className="metric-top">
            <span className="metric-label">Total Licenses</span>
            <div className="metric-badge blue">ALL ISSUED</div>
          </div>
          <div className="metric-body">
            <strong className="metric-num">{totalLicCount}</strong>
            <div className="metric-icon-wrap icon-blue">
              <KeyRound size={20} />
            </div>
          </div>
          <div className="metric-footer">
            <span>Total provisioned keys</span>
            <ArrowUpRight size={14} className="metric-arrow" />
          </div>
        </div>

        {/* Active Licenses */}
        <div
          className="metric-card clickable"
          onClick={() => onNavigate("licenses", "ACTIVE")}
          title="Click to view active licenses"
        >
          <div className="metric-top">
            <span className="metric-label">Active Licenses</span>
            <div className="metric-badge green">ACTIVE</div>
          </div>
          <div className="metric-body">
            <strong className="metric-num">{activeCount}</strong>
            <div className="metric-icon-wrap icon-green">
              <ShieldCheck size={20} />
            </div>
          </div>
          <div className="metric-footer">
            <span>
              {totalLicCount > 0
                ? `${Math.round((activeCount / totalLicCount) * 100)}% active ratio`
                : "100% active"}
            </span>
            <ArrowUpRight size={14} className="metric-arrow" />
          </div>
        </div>

        {/* Total Expired / Revoked */}
        <div
          className="metric-card clickable"
          onClick={() => onNavigate("licenses", "REVOKED")}
          title="Click to inspect revoked & expired licenses"
        >
          <div className="metric-top">
            <span className="metric-label">Total Expired / Revoked</span>
            <div className="metric-badge red">ACTIONABLE</div>
          </div>
          <div className="metric-body">
            <strong className="metric-num">{revokedCount}</strong>
            <div className="metric-icon-wrap icon-red">
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="metric-footer">
            <span>Suspended or terminated</span>
            <ArrowUpRight size={14} className="metric-arrow" />
          </div>
        </div>

        {/* Total Applications */}
        <div
          className="metric-card clickable"
          onClick={() => onNavigate("applications")}
          title="Click to view all applications"
        >
          <div className="metric-top">
            <span className="metric-label">Total Applications</span>
            <div className="metric-badge purple">FLEET</div>
          </div>
          <div className="metric-body">
            <strong className="metric-num">{appsCount}</strong>
            <div className="metric-icon-wrap icon-purple">
              <AppWindow size={20} />
            </div>
          </div>
          <div className="metric-footer">
            <span>Synchronized app products</span>
            <ArrowUpRight size={14} className="metric-arrow" />
          </div>
        </div>

        {/* Total Vendors / Tenants */}
        <div
          className="metric-card clickable"
          onClick={() => onNavigate("tenants")}
          title="Click to view vendors & tenants"
        >
          <div className="metric-top">
            <span className="metric-label">Total Vendors</span>
            <div className="metric-badge slate">TENANTS</div>
          </div>
          <div className="metric-body">
            <strong className="metric-num">{vendorsCount}</strong>
            <div className="metric-icon-wrap icon-slate">
              <Building2 size={20} />
            </div>
          </div>
          <div className="metric-footer">
            <span>Isolated tenant namespaces</span>
            <ArrowUpRight size={14} className="metric-arrow" />
          </div>
        </div>
      </div>

      {/* Row 1 Charts: Donut Chart (Circle) + Line Chart (Telemetry Activity) */}
      <div className="dashboard-charts-row">
        {/* Circle / Donut Chart */}
        <div className="chart-panel donut-panel">
          <div className="chart-panel-header">
            <div>
              <h3>License Health & Status Distribution</h3>
              <p>Cryptographic state breakdown</p>
            </div>
            <Zap size={18} className="panel-icon-accent" />
          </div>
          <DonutChart
            active={activeCount}
            revoked={revokedCount}
            total={totalLicCount}
          />
        </div>

        {/* Line Chart */}
        <div className="chart-panel line-panel">
          <ActivityLineChart
            onlineCount={onlineCount}
            totalActivations={dash?.activations ?? clients.length}
          />
        </div>
      </div>

      {/* Row 2 Charts: Vendor Wise Chart + Apps Wise Chart */}
      <div className="dashboard-charts-row">
        <VendorDistributionChart
          tenants={tenants}
          licenses={licenses}
          onSelectVendor={(vendorName) => onNavigate("licenses", vendorName)}
        />
        <AppsDistributionChart
          products={products}
          licenses={licenses}
          onSelectApp={(appName) => onNavigate("licenses", appName)}
        />
      </div>

      {/* Row 3: Live Connected Clients List + Security Audit Trail */}
      <div className="dashboard-bottom-grid">
        {/* Recent Client Activations */}
        <div className="panel data-panel">
          <div className="panel-head">
            <div>
              <h3>Live Client Sessions</h3>
              <p>Real-time mTLS connections & hardware health</p>
            </div>
            <button
              className="mini-btn"
              onClick={() => onNavigate("clients")}
            >
              View all clients →
            </button>
          </div>
          <div className="client-compact-list">
            {clients.slice(0, 6).map((c) => (
              <div
                key={c.id}
                className="client-compact-item"
                onClick={() => onSelectClient?.(c)}
                title="Click to view client attestation details"
              >
                <div className="client-glyph">
                  <Cpu size={16} />
                </div>
                <div className="grow">
                  <strong>
                    {c.license?.product?.tenant?.name} · {c.license?.product?.name}
                  </strong>
                  <span className="mono">{c.clientId}</span>
                </div>
                <div className="client-status-col">
                  <span
                    className={`badge ${c.socketOnline ? "online" : c.state.toLowerCase()}`}
                  >
                    {c.socketOnline ? "ONLINE" : c.state}
                  </span>
                  <small className="muted">{c.platform || "Workstation"}</small>
                </div>
              </div>
            ))}
            {!clients.length && (
              <div className="empty-panel-text">No active client sessions</div>
            )}
          </div>
        </div>

        {/* Security Activity & Audit Events */}
        <div className="panel data-panel">
          <div className="panel-head">
            <div>
              <h3>Security & Audit Log</h3>
              <p>Administrative actions & policy attestations</p>
            </div>
            <button
              className="mini-btn"
              onClick={() => onNavigate("audit")}
            >
              Full audit trail →
            </button>
          </div>
          <div className="audit-compact-list">
            {audits.slice(0, 6).map((a) => (
              <div key={String(a.id)} className="audit-compact-item">
                <div className="audit-event-info">
                  <strong>{a.action.replaceAll("_", " ")}</strong>
                  <span>
                    by {a.actor?.username || "System"} on {a.entityType}
                  </span>
                </div>
                <div className="audit-event-meta">
                  <span className={`badge ${a.severity.toLowerCase()}`}>
                    {a.severity}
                  </span>
                  <small className="muted">
                    {new Date(a.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </small>
                </div>
              </div>
            ))}
            {!audits.length && (
              <div className="empty-panel-text">No recent audit events</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
