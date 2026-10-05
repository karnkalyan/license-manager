import { useEffect, useState } from "react";
import {
  Activity,
  AppWindow,
  Building2,
  FileClock,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sun,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { ADMIN_UNAUTHORIZED_EVENT, api } from "./lib/api";
import type {
  Activation,
  Audit,
  Dashboard,
  License,
  ManagedUser,
  Product,
  SessionUser,
  Tenant,
  View,
} from "./types";
import { ApplicationsView } from "./components/ApplicationsView";
import { ClientsView } from "./components/ClientsView";
import { DashboardView } from "./components/DashboardView";
import { LicensesView } from "./components/LicensesView";
import { ChangePasswordView, LoginView } from "./components/LoginView";
import {
  ApplicationDetailsModal,
  BanClientModal,
  ClientDetailsModal,
  CreateApplication,
  CreateLicense,
  CreateTenant,
  CreateUser,
  LicenseDetailsModal,
  ReissueModules,
  VendorDetailsModal,
} from "./components/Modals";
import { TenantsView } from "./components/TenantsView";
import { AuditView, UsersView } from "./components/UsersAndAudit";

export default function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [mustChange, setMustChange] = useState<boolean | null>(null);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("lm_theme") as "light" | "dark") || "light",
  );
  const [view, setView] = useState<View>("dashboard");
  const [mobile, setMobile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  // Data states
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [clients, setClients] = useState<Activation[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);

  // Search & Navigation filters
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");

  // Operational Modals
  const [showLicense, setShowLicense] = useState(false);
  const [showTenant, setShowTenant] = useState(false);
  const [showApp, setShowApp] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const [banTarget, setBanTarget] = useState<Activation | null>(null);
  const [editLicense, setEditLicense] = useState<License | null>(null);

  // Detailed Inspection Modals
  const [detailsLicense, setDetailsLicense] = useState<License | null>(null);
  const [detailsProduct, setDetailsProduct] = useState<Product | null>(null);
  const [detailsTenant, setDetailsTenant] = useState<Tenant | null>(null);
  const [detailsClient, setDetailsClient] = useState<Activation | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("lm_theme", theme);
  }, [theme]);

  useEffect(() => {
    const expired = () => {
      setAuthenticated(false);
      setMustChange(false);
      setSession(null);
      setShowLicense(false);
    };
    window.addEventListener(ADMIN_UNAUTHORIZED_EVENT, expired);
    return () => window.removeEventListener(ADMIN_UNAUTHORIZED_EVENT, expired);
  }, []);

  useEffect(() => {
    api<SessionUser>("/auth/me")
      .then((u) => {
        setAuthenticated(true);
        setMustChange(u.forcePasswordChange);
        setSession(u);
      })
      .catch(() => {
        setAuthenticated(false);
        setMustChange(false);
        setSession(null);
      });
  }, []);

  async function load() {
    if (authenticated !== true) return;
    setBusy(true);
    try {
      const canManageUsers = session?.role === "SUPER_ADMIN" || session?.role === "ADMIN";
      const [d, l, c, t, p, a, u] = await Promise.all([
        api<Dashboard>("/dashboard"),
        api<License[]>("/licenses"),
        api<Activation[]>("/clients"),
        api<Tenant[]>("/tenants"),
        api<Product[]>("/applications"),
        api<Audit[]>("/audit"),
        canManageUsers ? api<ManagedUser[]>("/users") : Promise.resolve([]),
      ]);
      setDash(d);
      setLicenses(l);
      setClients(c);
      setTenants(t);
      setProducts(p);
      setAudits(a);
      setUsers(u);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Load failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!authenticated || mustChange !== false) return;
    void load();
    const id = setInterval(() => void load(), 30000);
    return () => clearInterval(id);
  }, [authenticated, mustChange, session?.role]);

  async function logout() {
    try {
      await api<{ ok: boolean }>("/auth/logout", { method: "POST" });
    } catch {}
    setAuthenticated(false);
    setMustChange(false);
    setSession(null);
  }

  const done = (message: string) => {
    setToast(message);
    void load();
  };

  // Clickable widget navigation handler
  const handleNavigate = (targetView: View, filter = "ALL") => {
    setView(targetView);
    setActiveFilter(filter);
    if (filter !== "ALL" && filter !== "ONLINE" && filter !== "ACTIVE" && filter !== "REVOKED") {
      setSearch(filter);
    } else {
      setSearch("");
    }
    setMobile(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Auth checking loading state
  if (authenticated === null || mustChange === null) {
    return (
      <div className="login-screen-full single-panel">
        <div className="change-password-card" style={{ textAlign: "center" }}>
          <div className="brand-logo-sq" style={{ margin: "0 auto 16px" }}>
            <ShieldCheck size={28} />
          </div>
          <h2>Verifying Security Session…</h2>
          <p>Connecting to secure licensing enclave.</p>
        </div>
      </div>
    );
  }

  // Not authenticated: render full height/width corporate split-screen login
  if (authenticated === false) {
    return (
      <LoginView
        onLogin={(user) => {
          setAuthenticated(true);
          setMustChange(user.forcePasswordChange);
          setSession(user);
        }}
      />
    );
  }

  // Must change password
  if (mustChange) {
    return <ChangePasswordView onDone={() => setMustChange(false)} />;
  }

  const canAdminister = session?.role === "SUPER_ADMIN" || session?.role === "ADMIN";
  const canSupport = canAdminister || session?.role === "SUPPORT";

  const navItems: [View, string, React.ElementType][] = [
    ["dashboard", "Overview", LayoutDashboard],
    ["licenses", "Licenses", KeyRound],
    ["clients", "Client Monitoring", Users],
    ["tenants", "Vendors / Tenants", Building2],
    ["applications", "Applications", AppWindow],
    ...(canAdminister
      ? ([["users", "Users & Roles", UserCog]] as [View, string, React.ElementType][])
      : []),
    ["audit", "Audit Trail", FileClock],
  ];

  const onlineSessionsCount = dash?.online ?? clients.filter((c) => c.socketOnline).length;

  return (
    <div className="corporate-app-shell">
      {/* Sidebar Navigation */}
      <aside className={`corporate-sidebar ${mobile ? "open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-logo-sq">
            <ShieldCheck size={20} />
          </div>
          <div className="brand-text">
            <strong>Kashtrix</strong>
            <span>License Operations</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(([v, label, IconComponent]) => (
            <button
              key={v}
              className={`nav-button ${view === v ? "active" : ""}`}
              onClick={() => {
                setView(v);
                setActiveFilter("ALL");
                setMobile(false);
              }}
            >
              <IconComponent size={18} />
              <span>{label}</span>
              {v === "clients" && onlineSessionsCount > 0 && (
                <span className="nav-badge-pill">{onlineSessionsCount}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Sidebar Status Box */}
        <div
          className="sidebar-health-box clickable"
          onClick={() => handleNavigate("clients", "ONLINE")}
          title="Click to view online client sessions"
        >
          <span className="live-pulse" />
          <div className="health-box-info">
            <strong>{onlineSessionsCount} Clients Online</strong>
            <small>Active mTLS Sessions</small>
          </div>
        </div>

        {/* Sign out */}
        <button className="sidebar-logout-btn" onClick={logout}>
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </aside>

      {/* Mobile Backdrop */}
      {mobile && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobile(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Content Area */}
      <main className="corporate-main">
        {/* Top Navbar */}
        <header className="corporate-navbar">
          <div className="navbar-left">
            <button
              className="icon-btn mobile-menu-btn"
              onClick={() => setMobile(!mobile)}
              aria-label="Toggle navigation"
            >
              {mobile ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="navbar-title-group">
              <h2>{navItems.find((n) => n[0] === view)?.[1] || "Console"}</h2>
              <div className="navbar-breadcrumb">
                <span>Kashtrix</span>
                <span className="bread-sep">/</span>
                <span className="bread-current">{view}</span>
                <span className="role-pill">
                  {session?.tenant?.name ? session.tenant.name : "Multi-Vendor Global"} ·{" "}
                  {session?.role.replaceAll("_", " ")}
                </span>
              </div>
            </div>
          </div>

          <div className="navbar-right">
            {/* Live Status Button */}
            <button
              className="navbar-status-pill"
              onClick={() => handleNavigate("clients", "ONLINE")}
              title="Click to view live mTLS sessions"
            >
              <span className="status-dot-green" />
              <span>{onlineSessionsCount} Online</span>
            </button>

            {/* Theme Switcher */}
            <button
              className="icon-btn"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Refresh Button */}
            <button
              className="icon-btn"
              onClick={() => void load()}
              title="Refresh operational data"
            >
              <RefreshCw size={18} className={busy ? "spin" : ""} />
            </button>

            {/* User Profile Pill */}
            <div className="navbar-user-chip">
              <div className="user-avatar-sq">
                {session?.username.slice(0, 2).toUpperCase() || "AD"}
              </div>
              <div className="user-chip-text">
                <strong>{session?.username}</strong>
                <span>{session?.role.replaceAll("_", " ")}</span>
              </div>
            </div>
          </div>
        </header>

        {/* View Body */}
        <div className="corporate-view-body">
          {view === "dashboard" && (
            <DashboardView
              dash={dash}
              clients={clients}
              audits={audits}
              tenants={tenants}
              products={products}
              licenses={licenses}
              onNavigate={handleNavigate}
              onSelectClient={(client) => setDetailsClient(client)}
            />
          )}

          {view === "licenses" && (
            <LicensesView
              licenses={licenses}
              search={search}
              setSearch={setSearch}
              onCreate={() => setShowLicense(true)}
              canManage={canAdminister}
              onEditModules={(l) => setEditLicense(l)}
              onViewDetails={(l) => setDetailsLicense(l)}
              initialFilter={activeFilter}
              onStatus={async (id, status) => {
                await api(`/licenses/${id}/status`, {
                  method: "POST",
                  body: JSON.stringify({
                    status,
                    reason:
                      status === "REVOKED"
                        ? "Revoked by administrator"
                        : undefined,
                  }),
                });
                done(`License status updated to ${status.toLowerCase()}`);
              }}
              onDelete={async (license) => {
                if (
                  !window.confirm(
                    `Permanently delete license ${license.serial}? This also removes its associated client activations.`,
                  )
                ) {
                  return;
                }
                await api(`/licenses/${license.id}`, { method: "DELETE" });
                done("License deleted");
              }}
            />
          )}

          {view === "clients" && (
            <ClientsView
              clients={clients}
              canSupport={canSupport}
              canManage={canAdminister}
              initialFilter={activeFilter}
              onViewDetails={(client) => setDetailsClient(client)}
              onBan={async (c) => {
                if (c.state === "BANNED") {
                  await api(`/clients/${c.clientId}/unban`, { method: "POST" });
                  done("Client unbanned");
                } else {
                  setBanTarget(c);
                }
              }}
              onRevalidate={async (c) => {
                await api(`/clients/${c.clientId}/revalidate`, {
                  method: "POST",
                });
                setToast("Signed revalidation challenge dispatched");
              }}
            />
          )}

          {view === "tenants" && (
            <TenantsView
              tenants={tenants}
              products={products}
              licenses={licenses}
              canManage={canAdminister}
              onCreate={() => setShowTenant(true)}
              onViewDetails={(t) => setDetailsTenant(t)}
              onStatus={async (t, status) => {
                await api(`/tenants/${t.id}/status`, {
                  method: "POST",
                  body: JSON.stringify({ status }),
                });
                done(`Vendor ${status.toLowerCase()}`);
              }}
            />
          )}

          {view === "applications" && (
            <ApplicationsView
              products={products}
              licenses={licenses}
              clients={clients}
              canManage={canAdminister}
              onCreate={() => setShowApp(true)}
              onViewDetails={(p) => setDetailsProduct(p)}
              onIssueLicense={() => setShowLicense(true)}
            />
          )}

          {view === "users" && canAdminister && (
            <UsersView
              users={users}
              currentUserId={session?.id ?? ""}
              onCreate={() => setShowUser(true)}
              onToggle={async (user) => {
                await api(`/users/${user.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ isActive: !user.isActive }),
                });
                done(`User ${user.isActive ? "disabled" : "enabled"}`);
              }}
              onDelete={async (user) => {
                if (!window.confirm(`Permanently delete user ${user.username}?`)) return;
                await api(`/users/${user.id}`, { method: "DELETE" });
                done("User deleted");
              }}
            />
          )}

          {view === "audit" && <AuditView rows={audits} />}
        </div>
      </main>

      {/* Operational Modals */}
      {showTenant && (
        <CreateTenant
          onClose={() => setShowTenant(false)}
          onCreated={() => {
            setShowTenant(false);
            done("Vendor / tenant created");
          }}
        />
      )}

      {showApp && (
        <CreateApplication
          tenants={tenants}
          onClose={() => setShowApp(false)}
          onCreated={() => {
            setShowApp(false);
            done("Application created");
          }}
        />
      )}

      {showUser && (
        <CreateUser
          tenants={tenants}
          isSuperAdmin={session?.role === "SUPER_ADMIN"}
          onClose={() => setShowUser(false)}
          onCreated={() => {
            setShowUser(false);
            done("User created");
          }}
        />
      )}

      {showLicense && (
        <CreateLicense
          onClose={() => setShowLicense(false)}
          onCreated={() => {
            setShowLicense(false);
            done("Cryptographic license generated");
          }}
        />
      )}

      {editLicense && (
        <ReissueModules
          license={editLicense}
          onClose={() => setEditLicense(null)}
          onDone={() => {
            setEditLicense(null);
            done("License updated and replacement key issued");
          }}
        />
      )}

      {banTarget && (
        <BanClientModal
          client={banTarget}
          onClose={() => setBanTarget(null)}
          onConfirm={async (reason) => {
            await api(`/clients/${banTarget.clientId}/ban`, {
              method: "POST",
              body: JSON.stringify({ reason }),
            });
            setBanTarget(null);
            done("Client installation banned");
          }}
        />
      )}

      {/* Deep Inspection Modals */}
      {detailsLicense && (
        <LicenseDetailsModal
          license={detailsLicense}
          onClose={() => setDetailsLicense(null)}
          canManage={canAdminister}
          onEditModules={(l) => {
            setDetailsLicense(null);
            setEditLicense(l);
          }}
          onStatus={async (id, status) => {
            await api(`/licenses/${id}/status`, {
              method: "POST",
              body: JSON.stringify({ status }),
            });
            done(`License ${status.toLowerCase()}`);
          }}
          onDelete={async (l) => {
            if (!window.confirm(`Delete license ${l.serial}?`)) return;
            await api(`/licenses/${l.id}`, { method: "DELETE" });
            done("License deleted");
          }}
        />
      )}

      {detailsProduct && (
        <ApplicationDetailsModal
          product={detailsProduct}
          licenses={licenses}
          clients={clients}
          onClose={() => setDetailsProduct(null)}
          onIssueLicense={() => {
            setDetailsProduct(null);
            setShowLicense(true);
          }}
        />
      )}

      {detailsTenant && (
        <VendorDetailsModal
          tenant={detailsTenant}
          products={products}
          licenses={licenses}
          canManage={canAdminister}
          onClose={() => setDetailsTenant(null)}
          onStatus={async (t, status) => {
            await api(`/tenants/${t.id}/status`, {
              method: "POST",
              body: JSON.stringify({ status }),
            });
            done(`Vendor ${status.toLowerCase()}`);
          }}
        />
      )}

      {detailsClient && (
        <ClientDetailsModal
          client={detailsClient}
          canSupport={canSupport}
          canManage={canAdminister}
          onClose={() => setDetailsClient(null)}
          onRevalidate={async (c) => {
            await api(`/clients/${c.clientId}/revalidate`, {
              method: "POST",
            });
            setToast("Signed revalidation challenge dispatched");
          }}
          onBan={async (c) => {
            setDetailsClient(null);
            if (c.state === "BANNED") {
              await api(`/clients/${c.clientId}/unban`, { method: "POST" });
              done("Client unbanned");
            } else {
              setBanTarget(c);
            }
          }}
        />
      )}

      {/* Feedback Toast */}
      {toast && (
        <div className="corporate-toast" role="status" onClick={() => setToast("")}>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
