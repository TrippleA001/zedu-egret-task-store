"use client";
import { supabaseBrowser } from "@/lib/supabase-client";

export default function LoginPage() {
  const login = async () => {
    const sb = supabaseBrowser();
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/` },
    });
  };
  return (
    <div className="bg-canvas/60">
      <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md rounded-xl border border-line bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-deep text-base font-black text-white">Z</span>
            <div>
              <p className="text-lg font-bold tracking-tight text-ink">Zedu Egret Store</p>
              <p className="text-[11px] font-medium uppercase tracking-widest text-muted">Task milestones</p>
            </div>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Log in</h1>
          <p className="mt-1 text-sm text-muted">
            Task verification &amp; onboarding portal. Use any Google account — you&apos;ll link your registered email next.
          </p>
          <button
            onClick={login}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover"
          >
            <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-black text-brand">G</span>
            Continue with Google
          </button>
          <div className="my-6 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" />
            80+ interns onboarding
            <span className="h-px flex-1 bg-line" />
          </div>
          <ol className="space-y-2 text-[13px] text-muted">
            <li><span className="font-semibold text-ink">1.</span> Onboard — link your registered email + Zedu ID</li>
            <li><span className="font-semibold text-ink">2.</span> Shop milestones — $0.00 stage products</li>
            <li><span className="font-semibold text-ink">3.</span> Get receipt — <span className="font-mono">ZE-2026-XXXX</span></li>
          </ol>
        </div>
      </div>
    </div>
  );
}
