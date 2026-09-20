import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ErrorState, LoadingState } from "../components/site";
import { getMe, getResource, getSummary, login, logout, patchResource, type AdminContext } from "./api";

type ResourceKey = "members" | "volunteers" | "programs" | "events" | "news" | "blood-requests" | "emergencies" | "contact-messages" | "donations" | "admins" | "audit-logs";
const navItems: { key: ResourceKey | "dashboard"; label: string; path: string; superOnly?: boolean }[] = [
  { key: "dashboard", label: "Dashboard", path: "/admin" },
  { key: "members", label: "Members", path: "/admin/members" },
  { key: "volunteers", label: "Volunteers", path: "/admin/volunteers" },
  { key: "programs", label: "Programs", path: "/admin/programs" },
  { key: "events", label: "Events", path: "/admin/events" },
  { key: "news", label: "News", path: "/admin/news" },
  { key: "blood-requests", label: "Blood requests", path: "/admin/blood-requests" },
  { key: "emergencies", label: "Emergencies", path: "/admin/emergencies" },
  { key: "contact-messages", label: "Contact messages", path: "/admin/contact-messages" },
  { key: "donations", label: "Donations", path: "/admin/donations" },
  { key: "admins", label: "Admin management", path: "/admin/admins", superOnly: true },
  { key: "audit-logs", label: "Audit logs", path: "/admin/audit-logs", superOnly: true },
];

const statusOptions: Record<string, string[]> = {
  members: ["pending", "approved", "rejected", "inactive"],
  volunteers: ["pending", "approved", "rejected", "inactive"],
  "blood-requests": ["open", "matched", "fulfilled", "cancelled", "expired"],
  emergencies: ["open", "acknowledged", "in_progress", "resolved", "closed"],
  "contact-messages": ["new", "in_progress", "resolved", "spam"],
  donations: ["pending", "succeeded", "failed", "refunded", "cancelled"],
};

export function AdminApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const [context, setContext] = useState<AdminContext | null>(null);
  const [loading, setLoading] = useState(location.pathname !== "/admin/login");

  useEffect(() => {
    if (location.pathname === "/admin/login") { setLoading(false); return; }
    getMe().then(setContext).catch(() => navigate("/admin/login", { replace: true })).finally(() => setLoading(false));
  }, [location.pathname, navigate]);

  if (location.pathname === "/admin/login") return <LoginPage onLogin={(next) => { setContext(next); navigate("/admin", { replace: true }); }} />;
  if (loading) return <div className="shell py-20"><LoadingState /></div>;
  if (!context) return null;
  return <AdminShell context={context} onLogout={() => { void logout().finally(() => navigate("/admin/login", { replace: true })); }}><AdminContent context={context} /></AdminShell>;
}

function LoginPage({ onLogin }: { onLogin: (context: AdminContext) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setSubmitting(true); setError(null);
    try { onLogin(await login(email, password)); } catch { setError("Invalid email or password."); } finally { setSubmitting(false); }
  }
  return <main className="min-h-screen bg-[var(--light)]"><div className="mx-auto max-w-md px-6 py-20"><div className="border border-[var(--border)] bg-white p-7 sm:p-9"><p className="eyebrow">IRCS-NIET administration</p><h1 className="mt-3 text-4xl font-semibold text-[var(--dark)]">Sign in</h1><p className="mt-4 text-sm leading-6 text-[var(--grey)]">Authorized administrators only.</p><form onSubmit={submit} className="mt-8 grid gap-5"><label className="grid gap-2 text-sm font-semibold">Email<input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></label><label className="grid gap-2 text-sm font-semibold">Password<input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label><button className="button button-primary mt-2 disabled:opacity-60" disabled={submitting}>{submitting ? "Signing in..." : "Sign in"}</button>{error && <div role="alert" className="border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div>}</form><Link to="/" className="mt-6 inline-block text-sm font-semibold text-[var(--crimson)]">Return to website</Link></div></div></main>;
}

function AdminShell({ context, onLogout, children }: { context: AdminContext; onLogout: () => void; children: ReactNode }) {
  return <div className="min-h-screen bg-[var(--light)]"><header className="border-b border-[var(--border)] bg-white"><div className="shell flex min-h-20 items-center justify-between gap-4"><div><p className="eyebrow">IRCS-NIET administration</p><p className="text-sm font-semibold text-[var(--dark)]">{context.email} <span className="font-normal text-[var(--grey)]">({context.role})</span></p></div><button type="button" className="button button-secondary" onClick={onLogout}>Log out</button></div></header><div className="shell grid gap-8 py-8 lg:grid-cols-[220px_1fr]"><aside className="border border-[var(--border)] bg-white p-3"><nav className="grid gap-1" aria-label="Admin navigation">{navItems.filter((item) => !item.superOnly || context.role === "super_admin").map((item) => <Link key={item.path} to={item.path} className="px-3 py-2 text-sm font-semibold text-[var(--dark)] hover:bg-[var(--light)]">{item.label}</Link>)}</nav></aside><main>{children}</main></div></div>;
}

function AdminContent({ context }: { context: AdminContext }) {
  const path = useLocation().pathname;
  if (path === "/admin" || path === "/admin/") return <Dashboard />;
  const key = path.split("/")[2] as ResourceKey;
  return <ResourcePage resource={key} context={context} />;
}

function Dashboard() {
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { getSummary().then(setSummary).catch(() => setError(true)); }, []);
  if (error) return <ErrorState onRetry={() => window.location.reload()} />;
  if (!summary) return <LoadingState />;
  const cards = [["pending_members", "Pending members"], ["pending_volunteers", "Pending volunteers"], ["pending_blood_requests", "Open blood requests"], ["open_emergencies", "Open emergencies"], ["new_contact_messages", "New contact messages"], ["pending_donations", "Donation intents to review"]];
  return <section><p className="eyebrow">Overview</p><h1 className="mt-2 text-4xl font-semibold text-[var(--dark)]">Dashboard</h1><div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([key, label]) => <div key={key} className="border border-[var(--border)] bg-white p-6"><strong className="block text-4xl font-semibold text-[var(--dark)]">{summary[key] ?? 0}</strong><span className="mt-2 block text-sm text-[var(--grey)]">{label}</span></div>)}</div></section>;
}

function ResourcePage({ resource, context }: { resource: ResourceKey; context: AdminContext }) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = () => { setLoading(true); setError(null); const endpoint = resource === "audit-logs" ? "/api/admin/audit-logs" : `/api/admin/${resource}`; getResource(endpoint).then((result) => setItems(result.items)).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load records.")).finally(() => setLoading(false)); };
  useEffect(load, [resource]);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState onRetry={load} />;
  const title = navItems.find((item) => item.key === resource)?.label ?? resource;
  return <section><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Management</p><h1 className="mt-2 text-4xl font-semibold text-[var(--dark)]">{title}</h1></div><span className="text-sm text-[var(--grey)]">{items.length} shown</span></div>{items.length === 0 ? <div className="mt-8"><div className="border border-dashed border-[var(--border)] bg-white p-10 text-center text-sm text-[var(--grey)]">No records found.</div></div> : <div className="mt-8 grid gap-4">{items.map((item) => <AdminRecord key={String(item.id)} item={item} resource={resource} context={context} onUpdated={load} />)}</div>}</section>;
}

function AdminRecord({ item, resource, context, onUpdated }: { item: Record<string, unknown>; resource: ResourceKey; context: AdminContext; onUpdated: () => void }) {
  const id = String(item.id ?? "");
  const statusField = resource === "donations" ? "payment_status" : "status";
  const canChange = Boolean(statusOptions[resource] && item[statusField] !== undefined);
  async function changeStatus(value: string) { await patchResource(`/api/admin/${resource}/${id}`, { [statusField]: value }); onUpdated(); }
  const shown = Object.entries(item).filter(([key]) => !["id", "message", "content", "description", "metadata"].includes(key)).slice(0, 8);
  return <article className="border border-[var(--border)] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="grid gap-2">{shown.map(([key, value]) => <div key={key} className="text-sm"><span className="font-semibold text-[var(--grey)]">{key.replaceAll("_", " ")}: </span><span className="text-[var(--dark)]">{String(value ?? "-")}</span></div>)}</div>{canChange && <label className="grid gap-1 text-xs font-semibold">Status<select className="field min-w-40" value={String(item[statusField])} onChange={(event) => void changeStatus(event.target.value)} disabled={context.role !== "admin" && context.role !== "super_admin"}>{statusOptions[resource].map((status) => <option key={status}>{status}</option>)}</select></label>}</div></article>;
}
