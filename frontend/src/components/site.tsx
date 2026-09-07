import { Menu, ArrowRight, HeartHandshake, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";

const navItems = [
  ["About", "/about"],
  ["Programs", "/programs"],
  ["Events", "/events"],
  ["Membership", "/membership"],
  ["Contact", "/contact"],
] as const;

export function SiteLayout({ children }: { children: ReactNode }) {
  return <><Navbar /><main>{children}</main><Footer /></>;
}

export function Navbar() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  return <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-white/95 backdrop-blur">
    <div className="shell flex min-h-20 items-center justify-between gap-6">
      <Link to="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
        <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--crimson)] text-white"><HeartHandshake size={23} /></span>
        <span className="leading-tight"><strong className="block text-sm tracking-[0.08em] text-[var(--dark)]">INDIAN RED CROSS SOCIETY</strong><span className="text-xs font-semibold tracking-[0.25em] text-[var(--crimson)]">NIET</span></span>
      </Link>
      <nav className="hidden items-center gap-7 lg:flex">{navItems.map(([label, href]) => <NavLink key={href} to={href} className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}>{label}</NavLink>)}<Link to="/donate" className="button button-primary">Donate now <ArrowRight size={16} /></Link></nav>
      <button type="button" className="icon-button lg:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
    </div>
    {open && <nav id="mobile-navigation" ref={menuRef} className="border-t border-[var(--border)] bg-white px-6 py-4 lg:hidden">{navItems.map(([label, href]) => <NavLink key={href} to={href} onClick={() => setOpen(false)} className="block border-b border-[var(--border)] py-3 text-sm font-semibold text-[var(--dark)]">{label}</NavLink>)}<Link to="/donate" onClick={() => setOpen(false)} className="button button-primary mt-4 w-full">Donate now <ArrowRight size={16} /></Link></nav>}
  </header>;
}

export function Footer() {
  return <footer className="border-t border-[var(--border)] bg-[var(--dark)] text-white"><div className="shell grid gap-10 py-12 md:grid-cols-[1.5fr_1fr_1fr]"><div><p className="eyebrow text-red-300">Indian Red Cross Society - NIET</p><h2 className="mt-3 max-w-sm text-2xl font-semibold leading-tight">A student-led space for service, learning and community care.</h2><p className="mt-4 max-w-md text-sm leading-6 text-slate-300">Official organisational information, contact details and programme records will be added after confirmation.</p></div><div><p className="eyebrow text-slate-400">Explore</p><div className="mt-4 grid gap-3 text-sm text-slate-200">{navItems.slice(0, 4).map(([label, href]) => <Link key={href} to={href} className="hover:text-white">{label}</Link>)}</div></div><div><p className="eyebrow text-slate-400">Contact placeholder</p><p className="mt-4 text-sm leading-6 text-slate-300">Official helpline, email and campus office details will be published here once supplied.</p></div></div><div className="border-t border-white/10"><div className="shell flex flex-col gap-2 py-5 text-xs text-slate-400 sm:flex-row sm:justify-between"><span>© {new Date().getFullYear()} Indian Red Cross Society - NIET</span><span>Noida Institute of Engineering & Technology</span></div></div></footer>;
}

export function SectionTitle({ eyebrow, title, description, align = "left" }: { eyebrow: string; title: string; description?: string; align?: "left" | "center" }) {
  return <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}><p className="eyebrow">{eyebrow}</p><h2 className="section-title">{title}</h2>{description && <p className="mt-4 text-base leading-7 text-[var(--grey)]">{description}</p>}</div>;
}

export function ProgramCard({ program }: { program: import("../types").Program }) {
  return <article className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-white"><div className="aspect-[16/9] overflow-hidden bg-slate-100"><img src={program.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /></div><div className="p-6"><p className="eyebrow">{program.category}</p><h3 className="mt-2 text-xl font-semibold text-[var(--dark)]">{program.title}</h3><p className="mt-3 text-sm leading-6 text-[var(--grey)]">{program.description}</p><Link to={`/programs/${program.id}`} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--crimson)]">Explore programme <ArrowRight size={15} /></Link></div></article>;
}

export function EventCard({ event }: { event: import("../types").EventItem }) {
  return <article className="border-l-4 border-[var(--crimson)] bg-[var(--light)] p-5"><p className="eyebrow">{event.program}</p><h3 className="mt-2 text-lg font-semibold text-[var(--dark)]">{event.title}</h3><p className="mt-2 text-sm leading-6 text-[var(--grey)]">{event.description}</p><div className="mt-4 grid gap-1 text-xs font-semibold text-[var(--dark)]"><span>{event.date}</span><span>{event.location}</span></div></article>;
}

export function NewsCard({ item }: { item: import("../types").NewsItem }) {
  return <article className="border-t-2 border-[var(--dark)] pt-5"><p className="eyebrow">{item.publishedDate}</p><h3 className="mt-2 text-lg font-semibold text-[var(--dark)]">{item.title}</h3><p className="mt-2 text-sm leading-6 text-[var(--grey)]">{item.summary}</p></article>;
}

export function ImpactCard({ value, label }: { value: string; label: string }) {
  return <div className="border-l border-[var(--crimson)] pl-4"><strong className="block text-3xl font-semibold text-[var(--dark)]">{value}</strong><span className="mt-1 block text-sm text-[var(--grey)]">{label}</span></div>;
}

export function FormInput({ label, name, type = "text", placeholder, required = true }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean }) {
  return <label className="grid gap-2 text-sm font-semibold text-[var(--dark)]">{label}<input className="field" name={name} type={type} placeholder={placeholder} required={required} /></label>;
}

export function FormNotice() {
  return <div className="mt-5 border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">Backend connection is not enabled for this action yet. No information has been submitted or stored.</div>;
}

export function LoadingState() { return <div className="py-10 text-center text-sm text-[var(--grey)]">Loading content...</div>; }
export function ErrorState() { return <div className="border border-red-200 bg-red-50 p-5 text-sm text-red-900">This content is temporarily unavailable.</div>; }
export function EmptyState() { return <div className="border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--grey)]">No published information is available yet.</div>; }
