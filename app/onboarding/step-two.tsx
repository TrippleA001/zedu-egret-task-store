"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CHANNELS, SKILL_LEVELS } from "@/lib/constants";

export default function StepTwo({ prefill, workspaceEmail, zeduId, onBack }: {
  prefill: { full_name: string; github_url: string };
  workspaceEmail: string; zeduId: string; onBack: () => void;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(prefill.full_name);
  const [githubUrl, setGithubUrl] = useState(prefill.github_url);
  const [telegram, setTelegram] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [skill, setSkill] = useState(0);
  const [phase, setPhase] = useState<"profile" | "skill">("profile");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const toggle = (k: string) =>
    setChannels((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));

  const submit = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/onboarding/complete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_email: workspaceEmail, zedu_id: zeduId,
          full_name: fullName, github_url: githubUrl,
          telegram_handle: telegram, skill_rating: skill, channels,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Submit failed");
      router.replace("/");
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  if (phase === "profile") {
    return (
      <div className="card">
        <h2>Step 2 — Profile &amp; Community Checkpoints</h2>
        {msg && <p className="error">{msg}</p>}
        <label>Full name (pre-filled, editable)</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <label>GitHub URL (pre-filled, editable)</label>
        <input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/you" />
        <label>Telegram handle (without @)</label>
        <input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="username" />
        <h3>Mandatory channels — open each link &amp; join, then tick all</h3>
        <div className="grid">
          {CHANNELS.map((c) => (
            <label key={c.key} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontWeight: 400 }}>
              <input type="checkbox" style={{ width: 18 }} checked={channels.includes(c.key)} onChange={() => toggle(c.key)} />
              <span><b>{c.label}</b><br /><a href={c.url} target="_blank" rel="noreferrer">Join -&gt; {c.url}</a></span>
            </label>
          ))}
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onBack}>Back</button>
          <button className="btn" disabled={!fullName || !githubUrl || !telegram || channels.length !== 4} onClick={() => setPhase("skill")}>Continue</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Step 3 — Sub-team &amp; Technical Level</h2>
      {msg && <p className="error">{msg}</p>}
      <label>Sub-team</label>
      <input disabled placeholder="To be auto-assigned" title="Auto-assigned later" />
      <p className="muted">Our team will assign you based on your technical level below.</p>
      <label>Technical skill rating — be honest, used for grouping</label>
      <div className="grid">
        {SKILL_LEVELS.map((s) => (
          <button
            key={s.value}
            onClick={() => setSkill(s.value)}
            style={{
              textAlign: "left", padding: 12, borderRadius: 10,
              border: skill === s.value ? "2px solid #111" : "1px solid #ddd",
              background: skill === s.value ? "#fefce8" : "#fff", cursor: "pointer",
            }}
          >
            <div>{"*".repeat(s.value)} <b>{s.value} — {s.title}</b></div>
            <div className="muted">{s.desc}</div>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button className="btn btn-secondary" onClick={() => setPhase("profile")}>Back</button>
        <button className="btn" disabled={busy || skill < 1} onClick={submit}>
          {busy ? "Submitting..." : "Complete Onboarding"}
        </button>
      </div>
    </div>
  );
}
