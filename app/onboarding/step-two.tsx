"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CHANNELS, SKILL_LEVELS } from "@/lib/constants";
import { Alert, Field, Stepper, btnPrimary, btnSecondary, inputCls } from "../components/ui";

const STEP_LABELS = ["Identity", "Profile & channels", "Technical level"];
const CHANNEL_TILE: Record<string, string> = {
  telegram_announcement: "T",
  telegram_chat: "T",
  zedu_announcement: "Z",
  zedu_egret: "Z",
};

export default function StepTwo({ prefill, workspaceEmail, zeduId, onBack }: {
  prefill: { full_name: string; github_url: string };
  workspaceEmail: string; zeduId: string; onBack: () => void;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(prefill.full_name);
  const [githubUrl, setGithubUrl] = useState(prefill.github_url);
  const [telegram, setTelegram] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [visited, setVisited] = useState<string[]>([]);
  const [skill, setSkill] = useState(0);
  const [phase, setPhase] = useState<"profile" | "skill">("profile");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const markVisited = (k: string) =>
    setVisited((v) => (v.includes(k) ? v : [...v, k]));

  const toggle = (k: string) => {
    // Join-first: the checkbox only works after the Join button was opened.
    if (!channels.includes(k) && !visited.includes(k)) return;
    setChannels((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));
  };

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
      <div>
        <Stepper steps={STEP_LABELS} current={2} />
        <div className="mt-4 rounded-xl border border-line bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-bold text-ink">Profile &amp; community checkpoints</h2>
          <p className="mt-1 text-sm text-muted">Confirm your details and join every mandatory channel before continuing.</p>
          {msg && <div className="mt-4"><Alert kind="error">{msg}</Alert></div>}
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field label="Full name" hint="Pre-filled from roster, editable.">
              <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            <Field label="Telegram display name" hint="As shown on your Telegram profile, e.g. A Data Scientist.">
              <input className={inputCls} value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="e.g. A Data Scientist" autoCapitalize="words" autoCorrect="off" spellCheck={false} maxLength={100} />
            </Field>
          </div>
          <div className="mt-5">
            <Field label="GitHub URL" hint="Pre-filled from roster, editable.">
              <input className={inputCls} value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/you" />
            </Field>
          </div>
          <h3 className="mt-6 text-sm font-semibold text-ink">Mandatory channels <span className="font-normal text-muted">— tap Join for each channel first, then tick I&apos;ve joined ({channels.length}/4)</span></h3>
          <div className="mt-3 space-y-2">
            {CHANNELS.map((c) => {
              const on = channels.includes(c.key);
              const seen = visited.includes(c.key) || on;
              return (
                <div key={c.key} className={`flex flex-col gap-3 rounded-xl border p-4 transition sm:flex-row sm:items-center ${on ? "border-brand bg-brand-tint/50" : "border-line bg-white"}`}>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-black ${on ? "bg-brand text-white" : "bg-canvas text-muted"}`}>
                    {CHANNEL_TILE[c.key] ?? "•"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{c.label}</span>
                    <span className="block text-[13px] text-muted">{seen ? "Opened — complete joining, then tick the box." : "Tap Join first, then tick the box."}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <a
                      href={c.url} target="_blank" rel="noreferrer"
                      onClick={() => markVisited(c.key)}
                      className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover"
                    >
                      Join →
                    </a>
                    <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-semibold transition ${!seen ? "cursor-not-allowed border-line bg-canvas text-muted" : on ? "border-brand bg-white text-brand-deep" : "border-line bg-white text-muted hover:border-muted/60 hover:text-ink"}`} title={!seen ? "Tap Join first" : "Tick after joining"}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-[#008060] disabled:cursor-not-allowed"
                        checked={on}
                        disabled={!seen}
                        onChange={() => toggle(c.key)}
                        aria-label={`I've joined ${c.label}`}
                      />
                      I&apos;ve joined
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
            <button className={btnSecondary} onClick={onBack}>Back</button>
            <button className={btnPrimary} disabled={!fullName || !githubUrl || !telegram || channels.length !== 4} onClick={() => setPhase("skill")}>Continue</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Stepper steps={STEP_LABELS} current={3} />
      <div className="mt-4 rounded-xl border border-line bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold text-ink">Sub-team &amp; technical level</h2>
        {msg && <div className="mt-4"><Alert kind="error">{msg}</Alert></div>}
        <div className="mt-5">
          <Field label="Sub-team" hint="Our team will assign you based on your technical level below.">
            <div className="relative">
              <input className={inputCls} disabled placeholder="To be auto-assigned" title="Auto-assigned later" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden>🔒</span>
            </div>
          </Field>
        </div>
        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-ink">Technical skill rating <span className="font-normal text-muted">— be honest, used for grouping</span></legend>
          <div className="mt-3 space-y-2">
            {SKILL_LEVELS.map((s) => {
              const active = skill === s.value;
              return (
                <label
                  key={s.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                    active ? "border-brand bg-brand-tint/60 ring-1 ring-brand" : "border-line bg-white hover:border-muted/60 hover:bg-canvas/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="skill"
                    className="mt-1 h-4 w-4 shrink-0 accent-[#008060]"
                    checked={active}
                    onChange={() => setSkill(s.value)}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-ink">
                      {s.value} — {s.title}
                      <span className="ml-2 font-normal text-warn" aria-hidden>{"★".repeat(s.value)}{"☆".repeat(5 - s.value)}</span>
                    </span>
                    <span className="mt-0.5 block text-[13px] text-muted">{s.desc}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
          <button className={btnSecondary} onClick={() => setPhase("profile")}>Back</button>
          <button className={btnPrimary} disabled={busy || skill < 1} onClick={submit}>
            {busy ? "Submitting..." : "Complete onboarding"}
          </button>
        </div>
      </div>
    </div>
  );
}
