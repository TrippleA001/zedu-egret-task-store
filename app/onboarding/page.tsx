"use client";
import StepTwo from "./step-two";
import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-client";
import { Alert, Field, Stepper, btnPrimary, inputCls } from "../components/ui";

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
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand">Intern onboarding</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Set up your store account</h1>
      <div className="mt-4 rounded-lg border border-line bg-canvas px-4 py-3 text-sm text-muted">
        Logged in as <span className="font-semibold text-ink">{authEmail || "..."}</span> (Google session). Now link your roster identity below — your login Gmail may differ from your roster email.
      </div>
      <div className="mt-6">
        <Stepper steps={["Identity", "Profile & channels", "Technical level"]} current={step} />
      </div>
      <div className="mt-6">{msg && <Alert kind={msg.kind as "error" | "success"}>{msg.text}</Alert>}</div>
      {step === 1 && (
        <div className="mt-4 rounded-xl border border-line bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-bold text-ink">Identity confirmation</h2>
          <p className="mt-1 text-sm text-muted">Select the roster email issued to you and confirm it with your Zedu ID.</p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field label="Search your roster email">
              <input className={inputCls} placeholder="Type to filter..." value={q} onChange={(e) => setQ(e.target.value)} />
            </Field>
            <Field label="Workspace email">
              <select className={inputCls} value={workspaceEmail} onChange={(e) => setWorkspaceEmail(e.target.value)}>
                <option value="">Select your email</option>
                {options.map((o) => (
                  <option key={o.email} value={o.email}>{o.email}{o.hint ? ` — ${o.hint}` : ""}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-5">
            <Field label="Zedu ID (username)" hint="Must match the Zedu ID on file for the selected email.">
              <input className={inputCls} value={zeduId} onChange={(e) => setZeduId(e.target.value)} placeholder="e.g. zedu-abc123" />
            </Field>
          </div>
          <div className="mt-6">
            <button className={btnPrimary} disabled={busy || !workspaceEmail || !zeduId} onClick={verify}>
              {busy ? "Verifying..." : "Verify & continue"}
            </button>
          </div>
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
    </div>
  );
}
