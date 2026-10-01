"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-client";

export default function SiteHeader({ cartCount, onCartOpen }: { cartCount?: number; onCartOpen?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const sb = supabaseBrowser();
      const { data } = await sb.auth.getUser();
      setEmail(data.user?.email ?? null);
    })();
  }, [pathname]);

  const signOut = async () => {
    const sb = supabaseBrowser();
    await sb.auth.signOut();
    router.replace("/login");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 no-underline hover:no-underline">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-deep text-sm font-black text-white">Z</span>
          <span className="leading-tight">
            <span className="block text-[15px] font-bold tracking-tight text-ink">Zedu Egret Store</span>
            <span className="block text-[11px] font-medium uppercase tracking-widest text-muted">Task milestones</span>
          </span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 text-sm font-medium md:flex">
          <Link href="/" className={`rounded-md px-3 py-1.5 ${pathname === "/" ? "bg-canvas text-ink" : "text-muted hover:text-ink"}`}>Catalog</Link>
          <Link href="/onboarding" className={`rounded-md px-3 py-1.5 ${pathname === "/onboarding" ? "bg-canvas text-ink" : "text-muted hover:text-ink"}`}>Onboarding</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {email ? (
            <>
              <span className="hidden max-w-56 truncate rounded-full bg-canvas px-3 py-1.5 text-[13px] font-medium text-muted sm:block" title={email}>{email}</span>
              <button onClick={signOut} className="rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] font-semibold text-ink shadow-sm transition hover:bg-canvas">Sign out</button>
            </>
          ) : (
            <Link href="/login" className="rounded-lg bg-brand px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-brand-hover">Sign in</Link>
          )}
          {typeof cartCount === "number" && cartCount > 0 && (
            <button onClick={onCartOpen} className="relative rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] font-semibold text-ink shadow-sm transition hover:bg-canvas" aria-label="Open cart">
              Cart
              <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">{cartCount}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
