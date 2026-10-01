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
    <main className="container">
      <div className="card">
        <h1>Zedu Egret Store</h1>
        <p className="muted">Task verification &amp; onboarding portal. Sign in with Google to continue.</p>
        <button className="btn" onClick={login}>Continue with Google</button>
      </div>
    </main>
  );
}
