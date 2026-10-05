import { useState } from "react";
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { api } from "../lib/api";
import type { SessionUser } from "../types";

export function LoginView({
  onLogin,
}: {
  onLogin: (user: SessionUser) => void;
}) {
  const [username, setUsername] = useState(import.meta.env.DEV ? "admin" : "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const r = await api<{ user: SessionUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      onLogin(r.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  const fillDevCreds = () => {
    setUsername("admin");
    setPassword("123456");
  };

  return (
    <div className="login-screen-full">
      {/* Left Column: Sleek Corporate Showcase (NO Gradients, Clean Solid Corporate Palette) */}
      <aside className="login-showcase-panel" aria-label="Kashtrix Enterprise Licensing">
        <div className="showcase-content">
          <div className="showcase-brand">
            <div className="brand-logo-sq">
              <ShieldCheck size={22} />
            </div>
            <div className="brand-text">
              <strong>Kashtrix</strong>
              <span>License Operations Infrastructure</span>
            </div>
          </div>

          <div className="showcase-hero">
            <div className="status-pill-subtle">
              <span className="live-dot" />
              <span>Enterprise License Infrastructure v2.4</span>
            </div>
            <h1>Secure License Management & Real-Time Client Attestation</h1>
            <p>
              Hardware-anchored zero-trust licensing architecture. Enforce vendor
              isolation, cryptographically signed module entitlements, and
              continuous client health telemetry across distributed fleets.
            </p>
          </div>

          <div className="showcase-features">
            <div className="feature-card">
              <div className="feature-icon">
                <ShieldCheck size={18} />
              </div>
              <div className="feature-text">
                <strong>Mutual TLS & Hardware Attestation</strong>
                <span>Hardware-bound client keys with automated session renewal</span>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <Building2 size={18} />
              </div>
              <div className="feature-text">
                <strong>Vendor Isolation & Multi-Tenancy</strong>
                <span>Cryptographically distinct product namespaces per organization</span>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <KeyRound size={18} />
              </div>
              <div className="feature-text">
                <strong>Dynamic Entitlement Governance</strong>
                <span>Granular feature toggles, seat caps, and numeric device limits</span>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <Activity size={18} />
              </div>
              <div className="feature-text">
                <strong>Live Heartbeat & Tamper Defense</strong>
                <span>Continuous verification, hot revalidation, and instant ban broadcast</span>
              </div>
            </div>
          </div>

          <div className="showcase-footer">
            <div className="compliance-metrics">
              <div>
                <strong>99.99%</strong>
                <span>Validation Uptime</span>
              </div>
              <div className="divider-v" />
              <div>
                <strong>RSA-4096 / Ed25519</strong>
                <span>Signature Standard</span>
              </div>
              <div className="divider-v" />
              <div>
                <strong>mTLS 1.3</strong>
                <span>Enclave Transport</span>
              </div>
            </div>
            <p className="copyright-note">
              © {new Date().getFullYear()} Kashtrix Technologies Inc. All rights reserved.
            </p>
          </div>
        </div>
      </aside>

      {/* Right Column: Full Height Minimalist Corporate Login Form */}
      <section className="login-auth-pane">
        <div className="login-form-wrap">
          {/* Mobile branding header */}
          <div className="login-mobile-header">
            <div className="brand-logo-sq">
              <ShieldCheck size={20} />
            </div>
            <div>
              <strong>Kashtrix</strong>
              <span>License Manager</span>
            </div>
          </div>

          <div className="login-header">
            <span className="auth-badge">SECURE ACCESS</span>
            <h2>Sign in to License Manager</h2>
            <p>Enter your corporate administrative credentials to access your console.</p>
          </div>

          <form onSubmit={submit} className="login-actual-form">
            <div className="input-group">
              <label htmlFor="login-username">Username or Corporate Alias</label>
              <div className="corporate-input-wrapper">
                <Users size={17} className="input-icon" aria-hidden="true" />
                <input
                  id="login-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="admin or username"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="input-group">
              <div className="label-with-meta">
                <label htmlFor="login-password">Password</label>
              </div>
              <div className="corporate-input-wrapper">
                <Lock size={17} className="input-icon" aria-hidden="true" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error-alert" role="alert">
                <span className="error-dot" />
                <span>{error}</span>
              </div>
            )}

            {/* Standard Theme-Based Solid Button (NO Gradients!) */}
            <button
              type="submit"
              className="btn corporate-primary-btn"
              disabled={loading}
            >
              {loading ? (
                "Authenticating credentials…"
              ) : (
                <>
                  <span>Sign in to console</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Development Quick Fill in DEV mode */}
          {import.meta.env.DEV && (
            <div className="dev-account-pill">
              <div className="dev-account-info">
                <strong>Development Environment</strong>
                <span>Default: admin / 123456</span>
              </div>
              <button
                type="button"
                className="mini-btn"
                onClick={fillDevCreds}
              >
                Auto-fill
              </button>
            </div>
          )}

          <div className="security-notice">
            <CheckCircle2 size={15} />
            <span>Protected by mTLS session encryption and audit-logged RBAC.</span>
          </div>

          <div className="login-pane-footer">
            <p>
              Need operational access or account assistance?{" "}
              <a href="#help" onClick={(e) => { e.preventDefault(); alert("Please contact your organization's Kashtrix Security Administrator."); }}>
                Contact Security Admin
              </a>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export function ChangePasswordView({ onDone }: { onDone: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirm) {
      setError("New passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await api<{ ok: boolean }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Password change failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen-full single-panel">
      <div className="change-password-card">
        <div className="brand-logo-sq">
          <KeyRound size={22} />
        </div>
        <h2>Change Initial Password</h2>
        <p>
          For system security, the bootstrap development password must be replaced
          with a strong administrative passphrase before proceeding.
        </p>

        <form onSubmit={submit} className="login-actual-form">
          <div className="input-group">
            <label>Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="input-group">
            <label>New Password (min 12 characters)</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={12}
              required
            />
          </div>
          <div className="input-group">
            <label>Confirm New Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={12}
              required
            />
          </div>

          {error && <div className="login-error-alert">{error}</div>}

          <button className="btn corporate-primary-btn" disabled={loading}>
            {loading ? "Updating credentials…" : "Update & Access Console"}
          </button>
        </form>
      </div>
    </div>
  );
}
