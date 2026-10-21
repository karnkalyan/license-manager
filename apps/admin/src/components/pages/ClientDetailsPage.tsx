import { useState } from "react";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Copy,
  Cpu,
  Eye,
  KeyRound,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import type { Activation } from "../../types";

export function ClientDetailsPage({
  client,
  canSupport,
  canManage,
  onBack,
  onRevalidate,
  onBan,
  onUnban,
}: {
  client: Activation;
  canSupport: boolean;
  canManage: boolean;
  onBack: () => void;
  onRevalidate: (c: Activation) => void;
  onBan: (c: Activation, reason: string) => void;
  onUnban: (c: Activation) => void;
}) {
  const [copiedId, setCopiedId] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [showBanForm, setShowBanForm] = useState(false);

  const copyClientId = () => {
    navigator.clipboard.writeText(client.clientId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const isBanned = client.state === "BANNED";

  return (
    <div className="page-view-container">
      <div className="page-header">
        <div className="page-header-back">
          <button className="btn icon-btn back-btn" onClick={onBack} title="Back to Clients">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="page-breadcrumbs">
              <span>Client Monitoring</span>
              <span className="sep">/</span>
              <span className="mono current">{client.clientId}</span>
            </div>
            <div className="title-with-badge">
              <h2>Installation Inspection</h2>
              <span className={`badge ${client.state.toLowerCase()}`}>{client.state}</span>
              {client.socketOnline && <span className="status-pill-green">mTLS Live Online</span>}
            </div>
          </div>
        </div>

        <div className="header-action-group">
          {canSupport && (
            <button className="btn action-btn primary glow-btn" onClick={() => onRevalidate(client)}>
              <RefreshCw size={15} />
              <span>Send Revalidation Challenge</span>
            </button>
          )}

          {canManage && (
            isBanned ? (
              <button className="btn action-btn text-success" onClick={() => onUnban(client)}>
                <UserCheck size={15} />
                <span>Unban Installation</span>
              </button>
            ) : (
              <button className="btn action-btn text-danger" onClick={() => setShowBanForm(!showBanForm)}>
                <Ban size={15} />
                <span>Ban Installation</span>
              </button>
            )
          )}
        </div>
      </div>

      {showBanForm && !isBanned && (
        <div className="page-content-card alert-banner-card">
          <div className="card-section-head">
            <ShieldAlert size={18} className="text-danger" />
            <h3>Confirm Ban Installation</h3>
          </div>
          <p>
            Banning this installation terminates its active mTLS socket immediately and blocks all future license
            validations.
          </p>
          <div className="field-group">
            <label className="field-label">Reason for Ban <span className="req">*</span></label>
            <input
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="e.g. Suspected unauthorized cloning or breached terms"
              required
            />
          </div>
          <div className="page-actions-bar">
            <button className="btn" onClick={() => setShowBanForm(false)}>Cancel</button>
            <button
              className="btn action-btn text-danger glow-btn"
              disabled={!banReason.trim()}
              onClick={() => {
                onBan(client, banReason.trim());
                setShowBanForm(false);
              }}
            >
              Confirm Ban
            </button>
          </div>
        </div>
      )}

      <div className="page-two-col-layout">
        <div className="page-col-main">
          {/* Hardware & Identity */}
          <div className="page-content-card">
            <h3 className="section-title">Installation Hardware & Software</h3>
            <div className="details-property-grid">
              <div className="prop-item">
                <span className="prop-label">Client Installation ID</span>
                <div className="copyable-prop">
                  <span className="mono pink-text">{client.clientId}</span>
                  <button className="btn icon-btn mini-copy" onClick={copyClientId} title="Copy ID">
                    <Copy size={13} />
                    {copiedId && <span className="mini-tooltip">Copied</span>}
                  </button>
                </div>
              </div>

              <div className="prop-item">
                <span className="prop-label">Operating System Platform</span>
                <span className="prop-value">{client.platform || "Standard x86_64"}</span>
              </div>

              <div className="prop-item">
                <span className="prop-label">Client Application Version</span>
                <span className="prop-value mono">{client.appVersion || "v1.0.0"}</span>
              </div>

              <div className="prop-item">
                <span className="prop-label">Last Known IP Address</span>
                <span className="mono prop-value">{client.lastIp || "Encrypted mTLS Proxy"}</span>
              </div>

              <div className="prop-item">
                <span className="prop-label">Socket Connection State</span>
                <span className={client.socketOnline ? "text-success font-bold" : "text-secondary"}>
                  {client.socketOnline ? "Active TLS Socket" : "Offline / Standby"}
                </span>
              </div>

              <div className="prop-item">
                <span className="prop-label">Last Heartbeat</span>
                <span className="prop-value">
                  {client.lastHeartbeatAt ? new Date(client.lastHeartbeatAt).toLocaleString() : "Never recorded"}
                </span>
              </div>
            </div>
          </div>

          {/* Bound License Card */}
          <div className="page-content-card">
            <div className="card-section-head">
              <KeyRound size={18} className="pink-icon" />
              <h3>Bound Cryptographic License</h3>
            </div>

            <div className="details-property-grid">
              <div className="prop-item">
                <span className="prop-label">License Serial</span>
                <span className="mono pink-text font-bold">{client.license?.serial}</span>
              </div>

              <div className="prop-item">
                <span className="prop-label">Application</span>
                <span className="prop-value">{client.license?.product?.name}</span>
              </div>

              <div className="prop-item">
                <span className="prop-label">Vendor Namespace</span>
                <span className="prop-value">{client.license?.product?.tenant?.name}</span>
              </div>

              <div className="prop-item">
                <span className="prop-label">License Status</span>
                <span className={`badge ${client.license?.status?.toLowerCase()}`}>{client.license?.status}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Status Side Card */}
        <div className="page-col-side">
          <div className="page-content-card">
            <h3 className="section-title">Session State</h3>
            <div className="stats-vertical-stack">
              <div className="stat-box-card">
                <span className="label">mTLS Socket</span>
                <strong className={client.socketOnline ? "text-success" : ""}>
                  {client.socketOnline ? "ONLINE" : "OFFLINE"}
                </strong>
              </div>
              <div className="stat-box-card">
                <span className="label">Provisioning Stream</span>
                <strong>{client.provisioningOnline ? "WAITING" : "IDLE"}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
