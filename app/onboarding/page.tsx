"use client";
import StepTwo from "./step-two";
import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-client";

type EmailItem = { email: string; hint: string };

export default function OnboardingPage() {
  const router = useRouter();
  const [authEmail, setAuthEmail] = useState("");
  const [options, setOptions] = useState<EmailItem[]>([]);
  const [q, setQ] = useState("");
  const [workspaceEmail, setWorkspaceEmail] = useState("");
  const [zeduId, setZeduId] = useState("");
  const [step, setStep] = useState(1);
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [prefill, setPrefill] = useState({ full_name: "", github_url: "" });

  useEffect(() => {
    (async () => {
      const sb = supabaseBrowser();
      const { data } = await sb.auth.getUser();
      if (!data.user) { router.replace("/login"); return; }
      setAuthEmail(data.user.email || "");
      const { data: prof } = await sb.from("users").select("id").eq("id", data.user.id).maybeSingle();
      if (prof) router.replace("/");
    })();
  }, [router]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await fetch(`/api/roster/emails?q=${encodeURIComponent(q)}&limit=50`);
      const j = await r.json();
      if (j.items) setOptions(j.items);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const verify = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/onboarding/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_email: workspaceEmail, zedu_id: zeduId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Verification failed");
      setPrefill(j.prefill);
      setStep(2);
      setMsg({ kind: "success", text: "Identity verified. Complete your profile." });
    } catch (e: any) { setMsg({ kind: "error", text: e.message }); }
    finally { setBusy(false); }
  };

  return (
    <main className="container">
      <h1>Intern Onboarding</h1>
      <div className="banner">Logged in as <b>{authEmail || "..."}</b> (Google session). Link your roster identity below.</div>
      {msg && <p className={msg.kind}>{msg.text}</p>}
      {step === 1 && (
        <div className="card">
          <h2>Step 1 — Identity Confirmation</h2>
          <label>Search your roster email</label>
          <input placeholder="type to search..." value={q} onChange={(e) => setQ(e.target.value)} />
          <label>Workspace email (dropdown)</label>
          <select value={workspaceEmail} onChange={(e) => setWorkspaceEmail(e.target.value)}>
            <option value="">-- select your email --</option>
            {options.map((o) => (
              <option key={o.email} value={o.email}>{o.email}{o.hint ? ` - ${o.hint}` : ""}</option>
            ))}
          </select>
          <label>Zedu ID (username)</label>
          <input value={zeduId} onChange={(e) => setZeduId(e.target.value)} placeholder="e.g. zedu-abc123" />
          <button className="btn" disabled={busy || !workspaceEmail || !zeduId} onClick={verify}>
            {busy ? "Verifying..." : "Verify & Continue"}
          </button>
        </div>
      )}
      {step === 2 && (
        <StepTwo
          prefill={prefill}
          workspaceEmail={workspaceEmail}
          zeduId={zeduId}
          onBack={() => setStep(1)}
        />
      )}
    </main>
  );
}
