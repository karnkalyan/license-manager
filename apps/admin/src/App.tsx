import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AppWindow,
  Ban,
  Building2,
  CheckCircle2,
  Copy,
  Cpu,
  FileClock,
  KeyRound,
  Layers3,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sun,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { ADMIN_UNAUTHORIZED_EVENT, api } from "./lib/api";

type Dashboard = {
  licenses: number;
  active: number;
  revoked: number;
  activations: number;
  online: number;
  recentAudits: Audit[];
};
type Tenant = {
  id: string;
  publicId: string;
  code: string;
  name: string;
  description?: string;
  status: string;
  _count?: { products: number };
};
type Module = {
  id: string;
  publicId: string;
  code: string;
  name: string;
  description?: string;
  enabled: boolean;
};
type Capability = {
  code: string;
  name: string;
  description?: string;
  type: "boolean" | "integer";
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: boolean | number;
  unit?: string;
};
type Product = {
  id: string;
  publicId: string;
  code: string;
  name: string;
  description?: string;
  tenant: Tenant;
  modules: Module[];
  capabilities?: Capability[];
  _count?: { licenses: number };
};
type Activation = {
  id: string;
  clientId: string;
  state: string;
  socketOnline?: boolean;
  provisioningOnline?: boolean;
  platform?: string;
  appVersion?: string;
  lastHeartbeatAt?: string;
  tenantPublicId: string;
  productPublicId: string;
  license: {
    id: string;
    serial: string;
    status: string;
    product: { name: string; publicId: string; tenant: Tenant };
    modules: { module: Module }[];
  };
};
type License = {
  id: string;
  serial: string;
  customerRef?: string;
  metadata?: {
    customerName?: string;
    customerEmail?: string;
    entitlements?: Record<string, boolean | number>;
    provisioningId?: string;
  };
  status: string;
  jwtKey?: string;
  autoDelivered?: boolean;
  autoActivationRequested?: boolean;
  maxActivations: number;
  entitlementVersion: number;
  expiresAt?: string;
  createdAt: string;
  product: Product;
  modules: { module: Module }[];
  activations: Activation[];
};
type Audit = {
  id: string;
  action: string;
  entityType: string;
  severity: string;
  createdAt: string;
  actor?: { username: string };
};
type View =
  "dashboard" | "licenses" | "clients" | "tenants" | "applications" | "audit";

function Login({
  onLogin,
}: {
  onLogin: (forcePasswordChange: boolean) => void;
}) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const r = await api<{ user: { forcePasswordChange: boolean } }>(
        "/auth/login",
        { method: "POST", body: JSON.stringify({ username, password }) },
      );
      onLogin(r.user.forcePasswordChange);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="brand-mark">
          <ShieldCheck size={22} />
        </div>
        <div>
          <h1>License Control</h1>
          <p>Multi-tenant entitlement console</p>
        </div>
        <form onSubmit={submit}>
          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && <div className="error">{error}</div>}
          <button className="btn primary wide" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        {import.meta.env.DEV && (
          <small>
            Development only: admin / 123456 · password rotation is mandatory.
          </small>
        )}
      </div>
    </div>
  );
}

function ChangePassword({ onDone }: { onDone: () => void }) {
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
    <div className="login-shell">
      <div className="login-card">
        <div className="brand-mark">
          <KeyRound size={22} />
        </div>
        <div>
          <h1>Change bootstrap password</h1>
          <p>
            Administration remains locked until the development password is
            replaced.
          </p>
        </div>
        <form onSubmit={submit}>
          <label>
            Current password
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <label>
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={12}
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={12}
            />
          </label>
          {error && <div className="error">{error}</div>}
          <button className="btn primary wide" disabled={loading}>
            {loading ? "Updating…" : "Set secure password"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Badge({ value }: { value: string }) {
  return (
    <span className={`badge ${value.toLowerCase()}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}
function relative(d?: string) {
  if (!d) return "—";
  const n = Date.now() - new Date(d).getTime();
  const m = Math.floor(n / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function ShortId({ value }: { value: string }) {
  return (
    <span className="mono id-text" title={value}>
      {value}
    </span>
  );
}

export default function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [mustChange, setMustChange] = useState<boolean | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("lm_theme") as "light" | "dark") || "dark",
  );
  const [view, setView] = useState<View>("dashboard");
  const [mobile, setMobile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [clients, setClients] = useState<Activation[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [search, setSearch] = useState("");
  const [showLicense, setShowLicense] = useState(false);
  const [showTenant, setShowTenant] = useState(false);
  const [showApp, setShowApp] = useState(false);
  const [banTarget, setBanTarget] = useState<Activation | null>(null);
  const [editLicense, setEditLicense] = useState<License | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("lm_theme", theme);
  }, [theme]);
  useEffect(() => {
    const expired = () => {
      setAuthenticated(false);
      setMustChange(false);
      setShowLicense(false);
    };
    window.addEventListener(ADMIN_UNAUTHORIZED_EVENT, expired);
    return () => window.removeEventListener(ADMIN_UNAUTHORIZED_EVENT, expired);
  }, []);
  useEffect(() => {
    api<{ forcePasswordChange: boolean }>("/auth/me")
      .then((u) => {
        setAuthenticated(true);
        setMustChange(u.forcePasswordChange);
      })
      .catch(() => {
        setAuthenticated(false);
        setMustChange(false);
      });
  }, []);
  async function load() {
    if (authenticated !== true) return;
    setBusy(true);
    try {
      const [d, l, c, t, p, a] = await Promise.all([
        api<Dashboard>("/dashboard"),
        api<License[]>("/licenses"),
        api<Activation[]>("/clients"),
        api<Tenant[]>("/tenants"),
        api<Product[]>("/applications"),
        api<Audit[]>("/audit"),
      ]);
      setDash(d);
      setLicenses(l);
      setClients(c);
      setTenants(t);
      setProducts(p);
      setAudits(a);
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
  }, [authenticated, mustChange]);
  const shownLicenses = useMemo(
    () =>
      licenses.filter((l) =>
        `${l.serial} ${l.customerRef ?? ""} ${l.product.name} ${l.product.tenant.name} ${l.modules.map((x) => x.module.code).join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [licenses, search],
  );
  async function logout() {
    try {
      await api<{ ok: boolean }>("/auth/logout", { method: "POST" });
    } catch {}
    setAuthenticated(false);
    setMustChange(false);
  }
  const done = (message: string) => {
    setToast(message);
    void load();
  };

  if (authenticated === null || mustChange === null)
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="brand-mark">
            <ShieldCheck size={22} />
          </div>
          <h1>Checking session…</h1>
        </div>
      </div>
    );
  if (authenticated === false)
    return (
      <Login
        onLogin={(force) => {
          setAuthenticated(true);
          setMustChange(force);
        }}
      />
    );
  if (mustChange) return <ChangePassword onDone={() => setMustChange(false)} />;

  const nav: [View, string, React.ElementType][] = [
    ["dashboard", "Overview", LayoutDashboard],
    ["licenses", "Licenses", KeyRound],
    ["clients", "Live clients", Users],
    ["tenants", "Vendors / tenants", Building2],
    ["applications", "Applications", AppWindow],
    ["audit", "Audit trail", FileClock],
  ];
  return (
    <div className="app-shell">
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <div className="brand-mark small">
            <ShieldCheck size={18} />
          </div>
          <div>
            <strong>License Control</strong>
            <span>Tenant + module security</span>
          </div>
        </div>
        <nav>
          {nav.map(([v, label, I]) => (
            <button
              key={v}
              className={view === v ? "active" : ""}
              onClick={() => {
                setView(v);
                setMobile(false);
              }}
            >
              <I size={17} />
              {label}
            </button>
          ))}
        </nav>
        <div className="side-status">
          <span className="pulse" />
          <div>
            <strong>{dash?.online ?? 0} online</strong>
            <small>Validated TCP sessions</small>
          </div>
        </div>
        <button className="logout" onClick={logout}>
          <LogOut size={16} />
          Sign out
        </button>
      </aside>
      <main>
        <header>
          <button
            className="icon mobile-only"
            onClick={() => setMobile(!mobile)}
          >
            <Menu size={19} />
          </button>
          <div>
            <h2>{nav.find((n) => n[0] === view)?.[1]}</h2>
            <p>Application-isolated, module-aware licensing</p>
          </div>
          <div className="header-actions">
            <button
              className="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="icon" onClick={() => void load()}>
              <RefreshCw size={18} className={busy ? "spin" : ""} />
            </button>
            <div className="avatar">AD</div>
          </div>
        </header>
        <section className="content">
          {view === "dashboard" && (
            <DashboardView
              dash={dash}
              clients={clients}
              audits={audits}
              tenants={tenants}
              products={products}
            />
          )}
          {view === "licenses" && (
            <LicensesView
              licenses={shownLicenses}
              search={search}
              setSearch={setSearch}
              onCreate={() => setShowLicense(true)}
              onEditModules={setEditLicense}
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
                done(`License ${status.toLowerCase()}`);
              }}
            />
          )}
          {view === "clients" && (
            <ClientsView
              clients={clients}
              onBan={async (c) => {
                if (c.state === "BANNED") {
                  await api(`/clients/${c.clientId}/unban`, { method: "POST" });
                  done("Client unbanned");
                } else setBanTarget(c);
              }}
              onRevalidate={async (c) => {
                await api(`/clients/${c.clientId}/revalidate`, {
                  method: "POST",
                });
                setToast("Signed revalidation request sent");
              }}
            />
          )}
          {view === "tenants" && (
            <TenantsView
              tenants={tenants}
              onCreate={() => setShowTenant(true)}
              onStatus={async (t, status) => {
                await api(`/tenants/${t.id}/status`, {
                  method: "POST",
                  body: JSON.stringify({ status }),
                });
                done(`Tenant ${status.toLowerCase()}`);
              }}
            />
          )}
          {view === "applications" && (
            <ApplicationsView
              products={products}
              onCreate={() => setShowApp(true)}
            />
          )}
          {view === "audit" && <AuditView rows={audits} />}
        </section>
      </main>
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
      {showLicense && (
        <CreateLicense
          onClose={() => setShowLicense(false)}
          onCreated={() => {
            setShowLicense(false);
            done("License generated");
          }}
        />
      )}
      {editLicense && (
        <ReissueModules
          license={editLicense}
          onClose={() => setEditLicense(null)}
          onDone={() => {
            setEditLicense(null);
            done("Module entitlement reissued");
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
            done("Client banned");
          }}
        />
      )}
      {toast && (
        <div
          className="toast"
          key={toast + Date.now()}
          onAnimationEnd={() => setToast("")}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function DashboardView({
  dash,
  clients,
  audits,
  tenants,
  products,
}: {
  dash: Dashboard | null;
  clients: Activation[];
  audits: Audit[];
  tenants: Tenant[];
  products: Product[];
}) {
  const cards = [
    ["Active licenses", dash?.active ?? 0, KeyRound],
    ["Online clients", dash?.online ?? 0, Activity],
    ["Vendors", tenants.length, Building2],
    ["Applications", products.length, AppWindow],
  ] as const;
  return (
    <>
      <div className="metric-grid">
        {cards.map(([label, value, I]) => (
          <div className="metric" key={label}>
            <div className="metric-icon">
              <I size={17} />
            </div>
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>authoritative state</small>
            </div>
          </div>
        ))}
      </div>
      <div className="grid-two">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>License health</h3>
              <p>Online validation posture</p>
            </div>
            <Zap size={17} />
          </div>
          <div className="health-ring">
            <div>
              <strong>
                {dash?.licenses
                  ? Math.round(((dash.active || 0) / dash.licenses) * 100)
                  : 100}
                %
              </strong>
              <span>active</span>
            </div>
          </div>
          <div className="health-row">
            <span>Total licenses</span>
            <strong>{dash?.licenses ?? 0}</strong>
          </div>
          <div className="health-row">
            <span>Revoked</span>
            <strong>{dash?.revoked ?? 0}</strong>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Recent clients</h3>
              <p>Tenant/application-scoped installations</p>
            </div>
            <Cpu size={17} />
          </div>
          <div className="list">
            {clients.slice(0, 7).map((c) => (
              <div className="list-row" key={c.id}>
                <div className="client-glyph">
                  <Cpu size={15} />
                </div>
                <div className="grow">
                  <strong>
                    {c.license.product.tenant.name} · {c.license.product.name}
                  </strong>
                  <span>{c.clientId}</span>
                </div>
                <Badge
                  value={
                    c.socketOnline
                      ? "ONLINE"
                      : c.provisioningOnline
                        ? "WAITING_REVALIDATION"
                        : c.state
                  }
                />
              </div>
            ))}
            {!clients.length && <Empty text="No client activations yet" />}
          </div>
        </div>
      </div>
      <div className="panel table-panel">
        <div className="panel-head">
          <div>
            <h3>Security activity</h3>
            <p>Administrative and protocol events</p>
          </div>
          <FileClock size={17} />
        </div>
        <AuditTable rows={audits.slice(0, 8)} />
      </div>
    </>
  );
}

function LicensesView({
  licenses,
  search,
  setSearch,
  onCreate,
  onEditModules,
  onStatus,
}: {
  licenses: License[];
  search: string;
  setSearch: (s: string) => void;
  onCreate: () => void;
  onEditModules: (l: License) => void;
  onStatus: (id: string, s: string) => void;
}) {
  return (
    <div className="panel table-panel">
      <div className="toolbar">
        <div className="search">
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search serial, vendor, app, module or customer"
          />
        </div>
        <button className="btn primary" onClick={onCreate}>
          <Plus size={16} />
          Generate license
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>License</th>
              <th>Vendor / application</th>
              <th>Modules</th>
              <th>Status</th>
              <th>Seats</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {licenses.map((l) => (
              <tr key={l.id}>
                <td>
                  <strong className="mono">{l.serial}</strong>
                  <span>
                    {l.customerRef || "No customer reference"} · entitlement v
                    {l.entitlementVersion}
                  </span>
                </td>
                <td>
                  <strong>{l.product.tenant.name}</strong>
                  <span>{l.product.name}</span>
                </td>
                <td>
                  <div className="chips">
                    {l.modules.map((x) => (
                      <span className="chip" key={x.module.id}>
                        {x.module.code}
                      </span>
                    ))}
                    {!l.modules.length && (
                      <span className="muted">No modules</span>
                    )}
                  </div>
                </td>
                <td>
                  <Badge value={l.status} />
                </td>
                <td>
                  {l.activations.length}/{l.maxActivations}
                </td>
                <td>
                  <div className="row-actions">
                    <button onClick={() => onEditModules(l)}>
                      Details / modules
                    </button>
                    {l.status === "ACTIVE" ? (
                      <button
                        className="danger-link"
                        onClick={() => onStatus(l.id, "REVOKED")}
                      >
                        Revoke
                      </button>
                    ) : (
                      <button onClick={() => onStatus(l.id, "ACTIVE")}>
                        Restore
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!licenses.length && <Empty text="No licenses match this search" />}
      </div>
    </div>
  );
}

function ClientsView({
  clients,
  onBan,
  onRevalidate,
}: {
  clients: Activation[];
  onBan: (c: Activation) => void;
  onRevalidate: (c: Activation) => void;
}) {
  return (
    <div className="panel table-panel">
      <div className="panel-head">
        <div>
          <h3>Registered application clients</h3>
          <p>
            One mTLS channel carries validation, heartbeat and signed
            entitlement events.
          </p>
        </div>
        <Activity size={17} />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Vendor / app</th>
              <th>Modules</th>
              <th>Status</th>
              <th>Heartbeat</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong className="mono">{c.clientId}</strong>
                  <span>
                    {c.platform || "unknown"} ·{" "}
                    {c.appVersion || "version unknown"}
                  </span>
                </td>
                <td>
                  <strong>{c.license.product.tenant.name}</strong>
                  <span>{c.license.product.name}</span>
                </td>
                <td>
                  <div className="chips">
                    {c.license.modules.map((x) => (
                      <span className="chip" key={x.module.id}>
                        {x.module.code}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <Badge
                    value={
                      c.socketOnline
                        ? "ONLINE"
                        : c.provisioningOnline
                          ? "WAITING_REVALIDATION"
                          : c.state
                    }
                  />
                </td>
                <td>{relative(c.lastHeartbeatAt)}</td>
                <td>
                  <div className="row-actions">
                    <button onClick={() => onRevalidate(c)}>Revalidate</button>
                    <button
                      className={c.state === "BANNED" ? "" : "danger-link"}
                      onClick={() => onBan(c)}
                    >
                      {c.state === "BANNED" ? "Unban" : "Ban"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!clients.length && <Empty text="No registered clients" />}
      </div>
    </div>
  );
}

function TenantsView({
  tenants,
  onCreate,
  onStatus,
}: {
  tenants: Tenant[];
  onCreate: () => void;
  onStatus: (t: Tenant, status: string) => void;
}) {
  return (
    <>
      <div className="page-actions">
        <div>
          <h3>Vendors / tenants</h3>
          <p>
            Every tenant has a unique public namespace; applications and
            licenses cannot cross it.
          </p>
        </div>
        <button className="btn primary" onClick={onCreate}>
          <Plus size={16} />
          Add vendor
        </button>
      </div>
      <div className="cards">
        {tenants.map((t) => (
          <div className="product-card" key={t.id}>
            <div className="product-icon">
              <Building2 size={18} />
            </div>
            <h3>{t.name}</h3>
            <p className="mono">{t.code}</p>
            <ShortId value={t.publicId} />
            <div>
              <span>Applications</span>
              <strong>{t._count?.products ?? 0}</strong>
            </div>
            <button
              className={`btn wide ${t.status === "ACTIVE" ? "" : "primary"}`}
              onClick={() =>
                onStatus(t, t.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE")
              }
            >
              {t.status === "ACTIVE" ? "Suspend tenant" : "Activate tenant"}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function ApplicationsView({
  products,
  onCreate,
}: {
  products: Product[];
  onCreate: () => void;
}) {
  return (
    <>
      <div className="page-actions">
        <div>
          <h3>Applications and modules</h3>
          <p>Module catalogs are synchronized from client provisioning IDs.</p>
        </div>
        <button className="btn primary" onClick={onCreate}>
          <Plus size={16} />
          Add application
        </button>
      </div>
      <div className="cards">
        {products.map((p) => (
          <div className="product-card app-card" key={p.id}>
            <div className="card-top">
              <div className="product-icon">
                <AppWindow size={18} />
              </div>
            </div>
            <h3>{p.name}</h3>
            <p>
              {p.tenant.name} · <span className="mono">{p.code}</span>
            </p>
            <ShortId value={p.publicId} />
            <div className="module-list">
              <strong>Client-advertised modules</strong>
              <div className="chips">
                {p.modules.map((m) => (
                  <span
                    className={`chip ${m.enabled ? "" : "disabled"}`}
                    key={m.id}
                  >
                    {m.code}
                  </span>
                ))}
                {!p.modules.length && (
                  <span className="muted">Waiting for client provisioning</span>
                )}
              </div>
            </div>
            <div>
              <span>Issued licenses</span>
              <strong>{p._count?.licenses ?? 0}</strong>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function AuditView({ rows }: { rows: Audit[] }) {
  return (
    <div className="panel table-panel">
      <div className="panel-head">
        <div>
          <h3>Audit trail</h3>
          <p>Administrative and security-sensitive events</p>
        </div>
        <ShieldCheck size={17} />
      </div>
      <AuditTable rows={rows} />
    </div>
  );
}
function AuditTable({ rows }: { rows: Audit[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Event</th>
            <th>Entity</th>
            <th>Actor</th>
            <th>Severity</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r.id)}>
              <td>
                <strong>{r.action.replaceAll("_", " ")}</strong>
              </td>
              <td>{r.entityType}</td>
              <td>{r.actor?.username || "System"}</td>
              <td>
                <Badge value={r.severity} />
              </td>
              <td>{relative(r.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty text="No audit entries yet" />}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <ShieldCheck size={22} />
      <span>{text}</span>
    </div>
  );
}

function ModalFrame({
  title,
  subtitle,
  onClose,
  children,
  compact = false,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="modal-backdrop">
      <div className={`modal ${compact ? "compact-modal" : ""}`}>
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            <p>{subtitle}</p>
          </div>
          <button className="icon" onClick={onClose}>
            <XCircle size={19} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function initialEntitlements(
  capabilities: Capability[],
  current: Record<string, boolean | number> = {},
) {
  return Object.fromEntries(
    capabilities.map((capability) => [
      capability.code,
      current[capability.code] ??
        capability.defaultValue ??
        (capability.type === "boolean" ? false : (capability.min ?? 0)),
    ]),
  );
}
function CapabilitySelector({
  capabilities,
  values,
  onChange,
}: {
  capabilities: Capability[];
  values: Record<string, boolean | number>;
  onChange: (code: string, value: boolean | number) => void;
}) {
  return (
    <div className="module-selector">
      {capabilities.map((capability) =>
        capability.type === "boolean" ? (
          <label
            className="module-option capability-option capability-boolean"
            key={capability.code}
          >
            <input
              type="checkbox"
              checked={values[capability.code] === true}
              onChange={(event) =>
                onChange(capability.code, event.target.checked)
              }
            />
            <span>
              <strong>{capability.code}</strong>
              <small>{capability.name}</small>
            </span>
          </label>
        ) : (
          <label
            className="capability-option capability-number"
            key={capability.code}
          >
            <span className="capability-copy">
              <strong>{capability.code}</strong>
              <small>
                {capability.name}
                {capability.unit ? ` (${capability.unit})` : ""}
              </small>
              <small className="capability-range">
                Enter any whole number from {capability.min ?? 0} to{" "}
                {capability.max ?? 1000000}
              </small>
            </span>
            <span className="capability-number-control">
              <input
                aria-label={capability.name}
                type="number"
                inputMode="numeric"
                min={capability.min ?? 0}
                max={capability.max ?? 1000000}
                step={capability.step ?? 1}
                value={Number(
                  values[capability.code] ??
                    capability.defaultValue ??
                    capability.min ??
                    0,
                )}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => {
                  const value = event.currentTarget.valueAsNumber;
                  if (Number.isInteger(value)) onChange(capability.code, value);
                }}
              />
              {capability.unit && <em>{capability.unit}</em>}
            </span>
          </label>
        ),
      )}
    </div>
  );
}

function CreateTenant({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/tenants", {
        method: "POST",
        body: JSON.stringify({
          code: code
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9_-]/g, "_"),
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
      setLoading(false);
    }
  }
  return (
    <ModalFrame
      title="Add vendor / tenant"
      subtitle="Creates an isolated licensing namespace."
      onClose={onClose}
      compact
    >
      <form onSubmit={submit} className="ban-form">
        <label>
          Tenant code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="VENDOR_A"
            required
          />
        </label>
        <label>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Vendor A"
            required
          />
        </label>
        <label>
          Description
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={loading}>
            {loading ? "Creating…" : "Create tenant"}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

function CreateApplication({
  tenants,
  onClose,
  onCreated,
}: {
  tenants: Tenant[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [tenantId, setTenantId] = useState(tenants[0]?.id || "");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/applications", {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          code: code
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9_-]/g, "_"),
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
      setLoading(false);
    }
  }
  return (
    <ModalFrame
      title="Add application"
      subtitle="A unique application UUID is generated; modules arrive from its client provisioning ID."
      onClose={onClose}
    >
      <form onSubmit={submit} className="form-grid">
        <label>
          Vendor / tenant
          <select
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            required
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Application code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="DESKTOP_PRO"
            required
          />
        </label>
        <label>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Desktop Pro"
            required
          />
        </label>
        <label>
          Description
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
          />
        </label>
        {error && <div className="error full">{error}</div>}
        <div className="modal-actions full">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={loading}>
            Create application
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

function CreateLicense({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [resolvedProduct, setResolvedProduct] = useState<Product | null>(null);
  const selected = resolvedProduct;
  const [entitlements, setEntitlements] = useState<
    Record<string, boolean | number>
  >({});
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [provisioningId, setProvisioningId] = useState("");
  const [autoActivate, setAutoActivate] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [provisioningError, setProvisioningError] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxActivations, setMaxActivations] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<License | null>(null);
  useEffect(() => {
    const value = provisioningId.trim();
    setProvisioningError("");
    if (!value) {
      setResolvedProduct(null);
      setEntitlements({});
      return;
    }
    if (!value.startsWith("KTX1.")) {
      setResolvedProduct(null);
      setEntitlements({});
      setProvisioningError(
        "Paste the KTX1 provisioning ID shown by the client application.",
      );
      return;
    }
    const timer = window.setTimeout(async () => {
      setResolving(true);
      try {
        const result = await api<{
          product: Product;
          hwid: string;
          capabilities: Capability[];
        }>("/applications/resolve-provisioning", {
          method: "POST",
          body: JSON.stringify({ provisioningId: value }),
        });
        const product = {
          ...result.product,
          capabilities: result.capabilities,
        };
        setResolvedProduct(product);
        setEntitlements(initialEntitlements(result.capabilities));
        setProvisioningError("");
      } catch (e) {
        setResolvedProduct(null);
        setEntitlements({});
        setProvisioningError(
          e instanceof Error ? e.message : "Provisioning ID lookup failed",
        );
      } finally {
        setResolving(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [provisioningId]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!resolvedProduct) {
      setError("Paste and resolve the client provisioning ID first");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const l = await api<License>("/licenses", {
        method: "POST",
        body: JSON.stringify({
          moduleIds: [],
          entitlements,
          provisioningId: provisioningId.trim(),
          customerName: customerName.trim() || undefined,
          customerEmail: customerEmail.trim() || undefined,
          expiresAt: expiresAt || undefined,
          maxActivations,
          autoActivate,
        }),
      });
      setCreated(l);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }
  return (
    <ModalFrame
      title={created ? "License generated" : "Generate license"}
      subtitle={
        created
          ? "The JWT is displayed once. Store it securely."
          : "Paste the client provisioning ID, then choose the modules advertised by that installation."
      }
      onClose={onClose}
    >
      {created ? (
        <KeyResult license={created} onDone={onCreated} />
      ) : (
        <form onSubmit={submit} className="form-grid">
          <label className="full">
            Client provisioning ID
            <input
              value={provisioningId}
              onChange={(e) => setProvisioningId(e.target.value)}
              placeholder="Paste KTX1… from the client application"
            />
            <small>
              {resolving
                ? "Reading client module catalog…"
                : resolvedProduct
                  ? `Matched ${resolvedProduct.name}; ${resolvedProduct.modules.length} client-advertised modules loaded.`
                  : "The provisioning ID supplies the application, app-scoped HWID, and supported module catalog."}
            </small>
          </label>
          {provisioningError && (
            <div className="error full">{provisioningError}</div>
          )}
          <label className="full">
            Resolved application
            <input
              readOnly
              value={
                selected
                  ? `${selected.tenant.name} · ${selected.name}`
                  : "Waiting for a valid provisioning ID"
              }
            />
            <small>
              {selected && (
                <>
                  tenantId{" "}
                  <span className="mono">{selected.tenant.publicId}</span> ·
                  applicationId{" "}
                  <span className="mono">{selected.publicId}</span>
                </>
              )}
            </small>
          </label>
          <label>
            Customer / client name
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Optional customer name"
            />
          </label>
          <label>
            Customer email
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="Optional email"
            />
          </label>
          <label>
            Max activations
            <input
              type="number"
              min="1"
              max="50"
              value={maxActivations}
              onChange={(e) => setMaxActivations(Number(e.target.value))}
            />
          </label>
          <label>
            Expiration date
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            <small>Leave blank for no expiration.</small>
          </label>
          <label className="full">
            <span className="module-option">
              <input
                type="checkbox"
                checked={autoActivate}
                onChange={(e) => setAutoActivate(e.target.checked)}
              />
              <span>
                <strong>Activate connected client automatically</strong>
                <small>
                  Securely delivers the JWT over the client's waiting mTLS
                  connection. Manual copy remains available.
                </small>
              </span>
            </span>
          </label>
          <div className="full capability-field">
            <span>Client-advertised entitlements</span>
            {selected && (
              <CapabilitySelector
                capabilities={selected.capabilities || []}
                values={entitlements}
                onChange={(code, value) =>
                  setEntitlements((current) => ({ ...current, [code]: value }))
                }
              />
            )}
            <div>
              {!selected && (
                <span className="muted">
                  Paste a provisioning ID to load features and numeric limits
                  from the client.
                </span>
              )}
            </div>
          </div>
          {error && <div className="error full">{error}</div>}
          <div className="modal-actions full">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={
                loading ||
                resolving ||
                !resolvedProduct ||
                Boolean(provisioningError)
              }
            >
              <KeyRound size={16} />
              {loading ? "Generating…" : "Generate JWT"}
            </button>
          </div>
        </form>
      )}
    </ModalFrame>
  );
}

function productToDefaultCapabilities(product: Product): Capability[] {
  return (product.modules || []).map((m) => {
    if (m.code === "RECORDING_DEVICES") {
      return {
        code: m.code,
        name: m.name,
        description: m.description,
        type: "integer" as const,
        min: 0,
        max: 1000000,
        step: 1,
        defaultValue: 0,
        unit: "devices",
      };
    }
    if (m.code === "TRANSCODE_QUEUE_ITEMS") {
      return {
        code: m.code,
        name: m.name,
        description: m.description,
        type: "integer" as const,
        min: 0,
        max: 1000000,
        step: 1,
        defaultValue: 0,
        unit: "jobs",
      };
    }
    return {
      code: m.code,
      name: m.name,
      description: m.description,
      type: "boolean" as const,
      defaultValue: false,
    };
  });
}

function ReissueModules({
  license,
  onClose,
  onDone,
}: {
  license: License;
  onClose: () => void;
  onDone: () => void;
}) {
  const rememberedId = license.metadata?.provisioningId || "";
  const [provisioningId, setProvisioningId] = useState(rememberedId);
  const [catalog, setCatalog] = useState<Product | null>(() => {
    if (license.product?.modules?.length) {
      return {
        ...license.product,
        capabilities: productToDefaultCapabilities(license.product),
      };
    }
    return null;
  });
  const [entitlements, setEntitlements] = useState<
    Record<string, boolean | number>
  >(() => {
    const current =
      license.metadata?.entitlements ||
      Object.fromEntries(
        license.modules.map((item) => [item.module.code, true]),
      );
    const defaultCaps = license.product?.modules
      ? productToDefaultCapabilities(license.product)
      : [];
    return initialEntitlements(defaultCaps, current);
  });
  const [customerName, setCustomerName] = useState(
    license.metadata?.customerName || license.customerRef || "",
  );
  const [customerEmail, setCustomerEmail] = useState(
    license.metadata?.customerEmail || "",
  );
  const [expiresAt, setExpiresAt] = useState(
    license.expiresAt?.slice(0, 10) || "",
  );
  const [autoActivate, setAutoActivate] = useState(true);
  const [created, setCreated] = useState<License | null>(null);
  const [error, setError] = useState("");
  const [resolving, setResolving] = useState(false);
  useEffect(() => {
    const value = provisioningId.trim();
    if (!value) {
      if (license.product?.modules?.length) {
        const caps = productToDefaultCapabilities(license.product);
        setCatalog({ ...license.product, capabilities: caps });
        const current =
          license.metadata?.entitlements ||
          Object.fromEntries(
            license.modules.map((item) => [item.module.code, true]),
          );
        setEntitlements(initialEntitlements(caps, current));
      } else {
        setCatalog(null);
        setEntitlements({});
      }
      setError("");
      return;
    }
    if (!value.startsWith("KTX1.")) {
      setError(
        "Paste the KTX1 provisioning ID shown by the client application.",
      );
      return;
    }
    const timer = window.setTimeout(async () => {
      setResolving(true);
      setError("");
      try {
        const result = await api<{
          product: Product;
          capabilities: Capability[];
        }>("/applications/resolve-provisioning", {
          method: "POST",
          body: JSON.stringify({ provisioningId: value }),
        });
        if (result.product.id !== license.product.id)
          throw new Error("Provisioning ID belongs to a different application");
        setCatalog({ ...result.product, capabilities: result.capabilities });
        const current =
          license.metadata?.entitlements ||
          Object.fromEntries(
            license.modules.map((item) => [item.module.code, true]),
          );
        setEntitlements(initialEntitlements(result.capabilities, current));
      } catch (e) {
        if (license.product?.modules?.length) {
          const caps = productToDefaultCapabilities(license.product);
          setCatalog({ ...license.product, capabilities: caps });
        } else {
          setCatalog(null);
          setEntitlements({});
        }
        setError(e instanceof Error ? e.message : "Provisioning lookup failed");
      } finally {
        setResolving(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [provisioningId, license]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!catalog) return;
    setError("");
    try {
      const l = await api<License>(`/licenses/${license.id}/modules`, {
        method: "POST",
        body: JSON.stringify({
          provisioningId: provisioningId.trim() || undefined,
          moduleIds: [],
          entitlements,
          customerName: customerName.trim() || undefined,
          customerEmail: customerEmail.trim() || undefined,
          expiresAt: expiresAt || undefined,
          autoActivate,
        }),
      });
      setCreated(l);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reissue failed");
    }
  }
  return (
    <ModalFrame
      title={
        created
          ? "Replacement key generated"
          : "Change license details and modules"
      }
      subtitle={
        created
          ? "The previous JWT is now invalid for reconnects."
          : rememberedId
            ? "Client provisioning ID remembered from activation. Update details or module entitlements."
            : "Update client details and module entitlements."
      }
      onClose={onClose}
    >
      {created ? (
        <KeyResult license={created} onDone={onDone} />
      ) : (
        <form onSubmit={submit} className="ban-form">
          <div className="warning-box">
            <Layers3 size={17} />
            <span>
              Distribute the replacement key to the application. Connected
              clients receive a signed reissue notice; old keys are rejected on
              reconnect.
            </span>
          </div>
          <label>
            Client provisioning ID
            <input
              value={provisioningId}
              onChange={(e) => setProvisioningId(e.target.value)}
              placeholder="Paste KTX1… from the client (optional if client is already provisioned)"
            />
            <small>
              {resolving
                ? "Reading client module catalog…"
                : catalog
                  ? provisioningId.trim()
                    ? `${catalog.modules.length} client-advertised modules loaded${rememberedId && provisioningId === rememberedId ? " (remembered from activation)" : ""}.`
                    : `${catalog.modules.length} application modules loaded.`
                  : "Optional if product modules are already registered."}
            </small>
          </label>
          <label>
            Customer / client name
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Optional customer name"
            />
          </label>
          <label>
            Customer email
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="Optional email"
            />
          </label>
          <label>
            Expiration date
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </label>
          {catalog && (
            <CapabilitySelector
              capabilities={catalog.capabilities || []}
              values={entitlements}
              onChange={(code, value) =>
                setEntitlements((current) => ({ ...current, [code]: value }))
              }
            />
          )}
          {error && <div className="error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary" disabled={!catalog || resolving}>
              Reissue key
            </button>
          </div>
        </form>
      )}
    </ModalFrame>
  );
}

function KeyResult({
  license,
  onDone,
}: {
  license: License;
  onDone: () => void;
}) {
  const delivery = license.autoDelivered
    ? "Securely delivered to the connected client. Kashtrix is activating automatically."
    : license.autoActivationRequested
      ? "Client was not connected for remote activation. Copy and install the JWT manually."
      : "Automatic activation was not requested. Copy and install the JWT manually.";
  return (
    <div className="created-license">
      <div className="success-icon">
        <CheckCircle2 size={22} />
      </div>
      <strong className="mono">{license.serial}</strong>
      <p className="result-meta">
        {license.product.tenant.name} · {license.product.name} ·{" "}
        {Object.entries(license.metadata?.entitlements || {})
          .filter(
            ([, value]) =>
              value === true || (typeof value === "number" && value > 0),
          )
          .map(([code, value]) =>
            typeof value === "number" ? `${code}=${value}` : code,
          )
          .join(", ") || "no entitlements"}
      </p>
      <div className={license.autoDelivered ? "warning-box" : "error"}>
        {delivery}
      </div>
      <textarea readOnly value={license.jwtKey ?? ""} />
      <button
        className="btn"
        onClick={() => navigator.clipboard.writeText(license.jwtKey ?? "")}
      >
        <Copy size={16} />
        Copy JWT license key
      </button>
      <button className="btn primary wide" onClick={onDone}>
        Done
      </button>
    </div>
  );
}

function BanClientModal({
  client,
  onClose,
  onConfirm,
}: {
  client: Activation;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3) {
      setError("Enter a clear reason");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onConfirm(reason.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ban failed");
      setLoading(false);
    }
  }
  return (
    <ModalFrame
      title="Ban client installation"
      subtitle={client.clientId}
      onClose={onClose}
      compact
    >
      <form onSubmit={submit} className="ban-form">
        <div className="warning-box">
          <Ban size={17} />
          <span>
            This installation receives a signed CLIENT_BANNED event and its mTLS
            session is terminated.
          </span>
        </div>
        <label>
          Audit reason
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="Example: reported stolen workstation"
          />
        </label>
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn danger-btn" disabled={loading}>
            {loading ? "Banning…" : "Ban installation"}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
