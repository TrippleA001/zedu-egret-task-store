"use client";
import { useEffect } from "react";
import confetti from "canvas-confetti";
import Link from "next/link";

export default function SuccessPanel({ orderNumber, stage, email }: {
  orderNumber: string; stage: number; email: string;
}) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#008060", "#004c3f", "#cdeee1", "#f59e0b", "#ffffff"];
    const common = { colors, disableForReducedMotion: true, zIndex: 100 };
    confetti({ particleCount: 180, spread: 100, origin: { y: 0.3 }, ...common });
    // Side cannons + a delayed finale so every submission lands as a sequence,
    // not a single puff.
    const t1 = setTimeout(() => {
      confetti({ particleCount: 100, angle: 60, spread: 70, origin: { x: 0, y: 0.6 }, ...common });
      confetti({ particleCount: 100, angle: 120, spread: 70, origin: { x: 1, y: 0.6 }, ...common });
    }, 300);
    const t2 = setTimeout(() => {
      confetti({ particleCount: 240, spread: 160, startVelocity: 42, origin: { y: 0.25 }, scalar: 1.05, ...common });
    }, 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const lead =
    stage === 1
      ? "Task 1 verified — you're on the contributors board now. Keep the momentum going."
      : `Task ${stage} verified and on your permanent record. On to the next one.`;

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-brand/30 bg-white shadow-sm">
      <div className="bg-brand-deep px-5 py-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/80">Task {stage} complete</p>
        <h2 className="mt-0.5 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
          Task {stage} complete — well done!
        </h2>
      </div>
      <div className="px-5 py-5 sm:px-6">
        <p className="font-mono text-lg font-bold tracking-tight text-ink">{orderNumber}</p>
        <p className="mt-2 text-[15px] leading-relaxed text-ink">{lead}</p>
        <p className="mt-2 text-sm text-muted">
          {email === "sent"
            ? "Receipt emailed to you — a copy is also in your notifications bell."
            : "Receipt saved to your notifications bell (top-right). Email backup was unavailable."}
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Link href="/contributors" className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover hover:no-underline">
            View contributors
          </Link>
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="inline-flex items-center justify-center rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition hover:bg-canvas">
            Back to catalog
          </button>
        </div>
      </div>
    </div>
  );
}