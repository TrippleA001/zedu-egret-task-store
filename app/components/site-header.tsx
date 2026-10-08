"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-client";

type Notif = {
  id: string; kind: string; title: string; body: string;
  order_number: string | null; read_at: string | null; created_at: string;
};

function initials(email: string) {
  const name = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  const parts = name.split(" ").filter(Boolean);
  return ((parts[0]?.[0] || "Z") + (parts[1]?.[0] || "E")).toUpperCase();
}

function navLinks(pathname: string) {
  const items = [
    { href: "/", label: "Catalog" },
    { href: "/profile", label: "Profile" },
    { href: "/contributors", label: "Contributors" },
    { href: "/onboarding", label: "Onboarding" },
  ];
  return items.map((n) => {
    const active = pathname === n.href;
    return (
      <Link key={n.href} href={n.href} className={`relative rounded-md px-3 py-2 transition ${active ? "text-ink" : "text-muted hover:text-ink"}`}>
        {n.label}
        {active && <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-brand" />}
      </Link>
    );
  });
}

function BellPanel({ notifs }: { notifs: Notif[] }) {
  return (
    <div className="absolute right-0 top-12 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-white shadow-xl sm:w-96">
      <div className="border-b border-line bg-canvas/60 px-4 py-3">
        <p className="text-sm font-bold text-ink">Notifications</p>
        <p className="text-xs text-muted">Order receipts land here — email is a backup.</p>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {notifs.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">No notifications yet. Complete Stage 1 to get your first receipt.</p>
        ) : (
          notifs.map((n) => (
            <div key={n.id} className={`border-b border-line px-4 py-3 last:border-0 ${!n.read_at ? "bg-brand-tint/40" : ""}`}>
              <p className="text-sm font-semibold text-ink">{n.title}</p>
              <p className="mt-0.5 whitespace-pre-line text-[13px] text-muted">{n.body}</p>
              <p className="mt-1 text-[11px] text-muted">{new Date(n.created_at).toLocaleString()}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
export default function SiteHeader({ cartCount, onCartOpen }: {
  cartCount?: number; onCartOpen?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const loadNotifs = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications");
      if (!r.ok) return;
      const j = await r.json();
      setNotifs(j.items || []);
      setUnread(j.unread || 0);
    } catch { /* inbox unavailable until migration 002 runs */ }
  }, []);

  const loadProgress = useCallback(async () => {
    try {
      const [rp, ro] = await Promise.all([
        fetch("/api/products").then((r) => r.json()),
        fetch("/api/orders").then((r) => r.json()),
      ]);
      const total = Array.isArray(rp.items) ? rp.items.length : 0;
      const done = Array.isArray(ro.stages) ? ro.stages.length : 0;
      if (total > 0) setProgress({ done, total });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    (async () => {
      const sb = supabaseBrowser();
      const { data } = await sb.auth.getUser();
      setEmail(data.user?.email ?? null);
      if (data.user) { loadNotifs(); loadProgress(); }
    })();
  }, [pathname, loadNotifs, loadProgress]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => { setMenuOpen(false); setBellOpen(false); setMobileOpen(false); }, [pathname]);

  const signOut = async () => {
    const sb = supabaseBrowser();
    await sb.auth.signOut();
    router.replace("/login");
  };

  const openBell = async () => {
    const next = !bellOpen;
    setBellOpen(next);
    if (next && unread > 0) {
      await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
      setNotifs((ns) => ns.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      setUnread(0);
    }
  };

  return (
    <header className={`sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur transition-shadow ${scrolled ? "shadow-[0_2px_12px_rgba(0,0,0,0.07)]" : ""}`}>
      <div className="mx-auto flex h-[72px] max-w-6xl items-center gap-3 px-4 sm:px-6">
        <button
          className="rounded-lg p-2 text-muted hover:bg-canvas md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu" aria-expanded={mobileOpen}
        >
          <span className="block h-0.5 w-5 bg-current" />
          <span className="mt-1 block h-0.5 w-5 bg-current" />
          <span className="mt-1 block h-0.5 w-5 bg-current" />
        </button>
        <Link href="/" className="flex items-center gap-2.5 no-underline hover:no-underline">
          <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-brand-deep text-base font-black text-white shadow-sm">
            Z
            {typeof progress?.done === "number" && typeof progress?.total === "number" && progress.total > 0 && (
              <span className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white ring-2 ring-white" title={`${progress.done} of ${progress.total} stages complete`}>
                {progress.done}/{progress.total}
              </span>
            )}
          </span>
          <span className="leading-tight">
            <span className="block text-[16px] font-extrabold tracking-tight text-ink">Zedu Egret Store</span>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Task milestones</span>
          </span>
        </Link>
        <nav className="ml-6 hidden items-center gap-1 text-[14px] font-semibold md:flex" aria-label="Primary">
          {navLinks(pathname)}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {typeof cartCount === "number" && cartCount > 0 && (
            <button onClick={onCartOpen} className="relative rounded-xl border border-line bg-white px-3.5 py-2 text-[13px] font-semibold text-ink shadow-sm transition hover:border-muted/50 hover:bg-canvas" aria-label="Open cart">
              Cart
              <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-white ring-2 ring-white">{cartCount}</span>
            </button>
          )}
          {email && (
            <div className="relative" ref={bellRef}>
              <button
                onClick={openBell}
                className={`relative rounded-xl border p-2.5 shadow-sm transition ${bellOpen ? "border-brand bg-brand-tint text-brand-deep" : "border-line bg-white text-muted hover:bg-canvas hover:text-ink"}`}
                aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
                aria-expanded={bellOpen}
              >
                <span aria-hidden className="text-base leading-none">🔔</span>
                {unread > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white ring-2 ring-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
              {bellOpen && <BellPanel notifs={notifs} />}
            </div>
          )}
          {email ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-deep text-[13px] font-bold text-white shadow-sm transition hover:bg-brand-hover"
                aria-label="Account menu" aria-expanded={menuOpen} title={email}
              >
                {initials(email)}
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-xl border border-line bg-white shadow-xl">
                  <div className="border-b border-line bg-canvas/60 px-4 py-3">
                    <p className="truncate text-sm font-bold text-ink" title={email}>{email}</p>
                    <p className="text-xs text-muted">Signed in with Google</p>
                  </div>
                  <Link href="/profile" className={`block px-4 py-2.5 text-left text-sm font-semibold hover:bg-canvas ${pathname === "/profile" ? "text-ink" : "text-muted"}`}>
                    Profile
                  </Link>
                  <button onClick={signOut} className="block w-full border-t border-line px-4 py-2.5 text-left text-sm font-semibold text-danger hover:bg-danger-bg">
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className="rounded-xl bg-brand px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-brand-hover hover:no-underline">Sign in</Link>
          )}
        </div>
      </div>
      {mobileOpen && (
        <nav className="border-t border-line bg-white px-4 py-2 md:hidden" aria-label="Mobile">
          <Link href="/" className={`block rounded-lg px-3 py-2.5 text-sm font-semibold ${pathname === "/" ? "bg-canvas text-ink" : "text-muted"}`}>Catalog</Link>
          <Link href="/profile" className={`block rounded-lg px-3 py-2.5 text-sm font-semibold ${pathname === "/profile" ? "bg-canvas text-ink" : "text-muted"}`}>Profile</Link>
          <Link href="/contributors" className={`block rounded-lg px-3 py-2.5 text-sm font-semibold ${pathname === "/contributors" ? "bg-canvas text-ink" : "text-muted"}`}>Contributors</Link>
          <Link href="/onboarding" className={`block rounded-lg px-3 py-2.5 text-sm font-semibold ${pathname === "/onboarding" ? "bg-canvas text-ink" : "text-muted"}`}>Onboarding</Link>
        </nav>
      )}
    </header>
  );
}
