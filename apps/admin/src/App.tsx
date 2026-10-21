import { useEffect, useState } from "react";
import {
  Activity,
  AppWindow,
  BookOpen,
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
  Store,
  Sun,
  Terminal,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { ADMIN_UNAUTHORIZED_EVENT, api } from "./lib/api";
import type {
  Activation,
  ApiKey,
  Audit,
  Dashboard,
  Dealer,
  License,
  ManagedUser,
  Product,
  SessionUser,
  Subpage,
  Tenant,
  View,
} from "./types";
import { ApplicationsView } from "./components/ApplicationsView";
import { ClientsView } from "./components/ClientsView";
import { DashboardView } from "./components/DashboardView";
import { LicensesView } from "./components/LicensesView";
import { ChangePasswordView, LoginView } from "./components/LoginView";
import { TenantsView } from "./components/TenantsView";
import { AuditView, UsersView } from "./components/UsersAndAudit";
import { DealersView } from "./components/DealersView";
import { ApiKeysView } from "./components/ApiKeysView";

// Page-wise responsive views (no modal popups)
import { CreateLicensePage } from "./components/pages/CreateLicensePage";
import { LicenseDetailsPage } from "./components/pages/LicenseDetailsPage";
import { LicenseExtendPage } from "./components/pages/LicenseExtendPage";
import { LicenseEditPage } from "./components/pages/LicenseEditPage";
import { CreateApplicationPage } from "./components/pages/CreateApplicationPage";
import { ApplicationDetailsPage } from "./components/pages/ApplicationDetailsPage";
import { CreateTenantPage } from "./components/pages/CreateTenantPage";
import { TenantDetailsPage } from "./components/pages/TenantDetailsPage";
import { ClientDetailsPage } from "./components/pages/ClientDetailsPage";
import { CreateDealerPage } from "./components/pages/CreateDealerPage";
import { DealerDetailsPage } from "./components/pages/DealerDetailsPage";
import { CreateUserPage } from "./components/pages/CreateUserPage";
import { CreateApiKeyPage } from "./components/pages/CreateApiKeyPage";
import { ApiDocsPage } from "./components/pages/ApiDocsPage";

export default function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [mustChange, setMustChange] = useState<boolean | null>(null);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("lm_theme") as "light" | "dark") || "light",
  );
  const [view, setView] = useState<View>("dashboard");
  const [subpage, setSubpage] = useState<Subpage>({ type: "none" });
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
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);

  // Search & Navigation filters
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("lm_theme", theme);
  }, [theme]);

  useEffect(() => {
    const expired = () => {
      setAuthenticated(false);
      setMustChange(false);
      setSession(null);
      setSubpage({ type: "none" });
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
      const [d, l, c, t, p, a, u, dl, k] = await Promise.all([
        api<Dashboard>("/dashboard"),
        api<License[]>("/licenses"),
        api<Activation[]>("/clients"),
        api<Tenant[]>("/tenants"),
        api<Product[]>("/applications"),
        api<Audit[]>("/audit"),
        canManageUsers ? api<ManagedUser[]>("/users") : Promise.resolve([]),
        api<Dealer[]>("/dealers").catch(() => []),
        api<ApiKey[]>("/api-keys").catch(() => []),
      ]);
      setDash(d);
      setLicenses(l);
      setClients(c);
      setTenants(t);
      setProducts(p);
      setAudits(a);
      setUsers(u);
      setDealers(dl);
      setApiKeys(k);
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
    setSubpage({ type: "none" });
  }

  const done = (message: string) => {
    setToast(message);
    void load();
  };

  // Clickable widget navigation handler
  const handleNavigate = (targetView: View, filter = "ALL") => {
    setView(targetView);
    setSubpage({ type: "none" });
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
          <p>Connecting to Kashtrix Deep Enclave.</p>
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

  const isDealer = session?.role === "DEALER" || session?.role === "FRANCHISE";
  const canAdminister = session?.role === "SUPER_ADMIN" || session?.role === "ADMIN";
  const canSupport = canAdminister || session?.role === "SUPPORT";

  const navItems: [View, string, React.ElementType][] = [
    ["dashboard", "Overview", LayoutDashboard],
    ["licenses", "Licenses", KeyRound],
    ["clients", "Client Monitoring", Users],
    ...(!isDealer ? ([["tenants", "Vendors / Tenants", Building2]] as [View, string, React.ElementType][]) : []),
    ["applications", isDealer ? "Assigned Products" : "Applications", AppWindow],
    ...(canAdminister ? ([["dealers", "Dealers & Franchises", Store]] as [View, string, React.ElementType][]) : []),
    ["api-keys", "API Enclave & Keys", Terminal],
    ...(canAdminister ? ([["users", "Users & Roles", UserCog]] as [View, string, React.ElementType][]) : []),
    ...(!isDealer ? ([["audit", "Audit Trail", FileClock]] as [View, string, React.ElementType][]) : []),
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
              className={`nav-button ${view === v && subpage.type === "none" ? "active" : ""}`}
              onClick={() => {
                setView(v);
                setSubpage({ type: "none" });
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
                {subpage.type !== "none" && (
                  <>
                    <span className="bread-sep">/</span>
                    <span className="bread-current subpage-current">{subpage.type.replace("-", " ")}</span>
                  </>
                )}
                <span className="role-pill">
                  {session?.dealerName
                    ? `${session.role === "FRANCHISE" ? "Franchise" : "Dealer"}: ${session.dealerName}`
                    : session?.tenant?.name
                      ? session.tenant.name
                      : "Multi-Vendor Global"}{" "}
                  · {session?.role.replaceAll("_", " ")}
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

        {/* View Body: Render Subpage or Main View */}
        <div className="corporate-view-body">
          {/* Subpages: Page-wise Views (Strictly No Modal Popups) */}
          {subpage.type === "create-license" && (
            <CreateLicensePage
              dealers={dealers}
              products={products}
              tenants={tenants}
              session={session}
              defaultProduct={subpage.defaultProduct}
              onBack={() => setSubpage({ type: "none" })}
              onDone={(msg) => {
                setSubpage({ type: "none" });
                done(msg);
              }}
            />
          )}

          {subpage.type === "license-details" && (
            <LicenseDetailsPage
              license={subpage.license}
              canManage={canAdminister}
              onBack={() => setSubpage({ type: "none" })}
              onEditModules={(l) => setSubpage({ type: "license-edit", license: l })}
              onExtend={(l) => setSubpage({ type: "license-extend", license: l })}
              onStatus={async (id, status) => {
                await api(`/licenses/${id}/status`, {
                  method: "POST",
                  body: JSON.stringify({ status }),
                });
                done(`License status updated to ${status.toLowerCase()}`);
                setSubpage({ type: "none" });
              }}
              onDelete={async (l) => {
                if (!window.confirm(`Permanently delete license ${l.serial}?`)) return;
                await api(`/licenses/${l.id}`, { method: "DELETE" });
                done("License deleted");
                setSubpage({ type: "none" });
              }}
            />
          )}

          {subpage.type === "license-extend" && (
            <LicenseExtendPage
              license={subpage.license}
              onBack={() => setSubpage({ type: "none" })}
              onDone={(msg) => {
                setSubpage({ type: "none" });
                done(msg);
              }}
            />
          )}

          {subpage.type === "license-edit" && (
            <LicenseEditPage
              license={subpage.license}
              onBack={() => setSubpage({ type: "none" })}
              onDone={(msg) => {
                setSubpage({ type: "none" });
                done(msg);
              }}
            />
          )}

          {subpage.type === "create-application" && (
            <CreateApplicationPage
              tenants={tenants}
              onBack={() => setSubpage({ type: "none" })}
              onCreated={(msg) => {
                setSubpage({ type: "none" });
                done(msg);
              }}
            />
          )}

          {subpage.type === "application-details" && (
            <ApplicationDetailsPage
              product={subpage.product}
              licenses={licenses}
              clients={clients}
              canManage={canAdminister}
              onBack={() => setSubpage({ type: "none" })}
              onIssueLicense={(p) => setSubpage({ type: "create-license", defaultProduct: p })}
            />
          )}

          {subpage.type === "create-tenant" && (
            <CreateTenantPage
              onBack={() => setSubpage({ type: "none" })}
              onCreated={(msg) => {
                setSubpage({ type: "none" });
                done(msg);
              }}
            />
          )}

          {subpage.type === "tenant-details" && (
            <TenantDetailsPage
              tenant={subpage.tenant}
              products={products}
              licenses={licenses}
              canManage={canAdminister}
              onBack={() => setSubpage({ type: "none" })}
              onStatus={async (t, status) => {
                await api(`/tenants/${t.id}/status`, {
                  method: "POST",
                  body: JSON.stringify({ status }),
                });
                done(`Vendor ${status.toLowerCase()}`);
                setSubpage({ type: "none" });
              }}
            />
          )}

          {subpage.type === "client-details" && (
            <ClientDetailsPage
              client={subpage.client}
              canSupport={canSupport}
              canManage={canAdminister}
              onBack={() => setSubpage({ type: "none" })}
              onRevalidate={async (c) => {
                await api(`/clients/${c.clientId}/revalidate`, { method: "POST" });
                setToast("Signed revalidation challenge dispatched");
              }}
              onBan={async (c, reason) => {
                await api(`/clients/${c.clientId}/ban`, {
                  method: "POST",
                  body: JSON.stringify({ reason }),
                });
                done("Client installation banned");
                setSubpage({ type: "none" });
              }}
              onUnban={async (c) => {
                await api(`/clients/${c.clientId}/unban`, { method: "POST" });
                done("Client unbanned");
                setSubpage({ type: "none" });
              }}
            />
          )}

          {subpage.type === "create-dealer" && (
            <CreateDealerPage
              products={products}
              tenants={tenants}
              onBack={() => setSubpage({ type: "none" })}
              onCreated={(msg) => {
                setSubpage({ type: "none" });
                done(msg);
              }}
            />
          )}

          {subpage.type === "dealer-details" && (
            <DealerDetailsPage
              dealer={subpage.dealer}
              products={products}
              canManage={canAdminister}
              onBack={() => setSubpage({ type: "none" })}
              onDone={(msg) => {
                setSubpage({ type: "none" });
                done(msg);
              }}
            />
          )}

          {subpage.type === "create-user" && (
            <CreateUserPage
              tenants={tenants}
              isSuperAdmin={session?.role === "SUPER_ADMIN"}
              onBack={() => setSubpage({ type: "none" })}
              onCreated={(msg) => {
                setSubpage({ type: "none" });
                done(msg);
              }}
            />
          )}

          {subpage.type === "create-api-key" && (
            <CreateApiKeyPage
              dealers={dealers}
              session={session}
              onBack={() => setSubpage({ type: "none" })}
              onCreated={(msg) => {
                setSubpage({ type: "none" });
                done(msg);
              }}
            />
          )}

          {subpage.type === "api-docs" && (
            <ApiDocsPage onBack={() => setSubpage({ type: "none" })} />
          )}

          {/* Main Views (Shown only when no subpage is active) */}
          {subpage.type === "none" && view === "dashboard" && (
            <DashboardView
              dash={dash}
              clients={clients}
              audits={audits}
              tenants={tenants}
              products={products}
              licenses={licenses}
              onNavigate={handleNavigate}
              onSelectClient={(client) => setSubpage({ type: "client-details", client })}
            />
          )}

          {subpage.type === "none" && view === "licenses" && (
            <LicensesView
              licenses={licenses}
              search={search}
              setSearch={setSearch}
              onCreate={() => setSubpage({ type: "create-license" })}
              canManage={canAdminister || isDealer}
              onEditModules={(l) => setSubpage({ type: "license-edit", license: l })}
              onExtend={(l) => setSubpage({ type: "license-extend", license: l })}
              onViewDetails={(l) => setSubpage({ type: "license-details", license: l })}
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

          {subpage.type === "none" && view === "clients" && (
            <ClientsView
              clients={clients}
              canSupport={canSupport}
              canManage={canAdminister}
              initialFilter={activeFilter}
              onViewDetails={(client) => setSubpage({ type: "client-details", client })}
              onBan={async (c) => {
                if (c.state === "BANNED") {
                  await api(`/clients/${c.clientId}/unban`, { method: "POST" });
                  done("Client unbanned");
                } else {
                  setSubpage({ type: "client-details", client: c });
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

          {subpage.type === "none" && view === "tenants" && (
            <TenantsView
              tenants={tenants}
              products={products}
              licenses={licenses}
              canManage={canAdminister}
              onCreate={() => setSubpage({ type: "create-tenant" })}
              onViewDetails={(t) => setSubpage({ type: "tenant-details", tenant: t })}
              onStatus={async (t, status) => {
                await api(`/tenants/${t.id}/status`, {
                  method: "POST",
                  body: JSON.stringify({ status }),
                });
                done(`Vendor ${status.toLowerCase()}`);
              }}
            />
          )}

          {subpage.type === "none" && view === "applications" && (
            <ApplicationsView
              products={products}
              licenses={licenses}
              clients={clients}
              canManage={canAdminister}
              onCreate={() => setSubpage({ type: "create-application" })}
              onViewDetails={(p) => setSubpage({ type: "application-details", product: p })}
              onIssueLicense={(p) => setSubpage({ type: "create-license", defaultProduct: p })}
            />
          )}

          {subpage.type === "none" && view === "dealers" && (
            <DealersView
              dealers={dealers}
              products={products}
              canManage={canAdminister}
              onCreate={() => setSubpage({ type: "create-dealer" })}
              onViewDetails={(d) => setSubpage({ type: "dealer-details", dealer: d })}
              onToggleStatus={async (d) => {
                await api(`/dealers/${d.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ isActive: !d.isActive }),
                });
                done(`Dealer ${d.isActive ? "suspended" : "activated"}`);
              }}
            />
          )}

          {subpage.type === "none" && view === "api-keys" && (
            <ApiKeysView
              apiKeys={apiKeys}
              canManage={true}
              onCreate={() => setSubpage({ type: "create-api-key" })}
              onViewDocs={() => setSubpage({ type: "api-docs" })}
              onToggleStatus={async (k) => {
                await api(`/api-keys/${k.id}/toggle`, { method: "POST" });
                done(`API Key ${k.isActive ? "disabled" : "enabled"}`);
              }}
              onDelete={async (k) => {
                if (!window.confirm(`Permanently revoke and delete API key "${k.name}"?`)) return;
                await api(`/api-keys/${k.id}`, { method: "DELETE" });
                done("API key revoked");
              }}
            />
          )}

          {subpage.type === "none" && view === "users" && canAdminister && (
            <UsersView
              users={users}
              currentUserId={session?.id ?? ""}
              onCreate={() => setSubpage({ type: "create-user" })}
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

          {subpage.type === "none" && view === "audit" && <AuditView rows={audits} />}
        </div>
      </main>

      {/* Feedback Toast */}
      {toast && (
        <div className="corporate-toast" role="status" onClick={() => setToast("")}>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
