"use client";
import { useEffect } from "react";
import confetti from "canvas-confetti";
import Link from "next/link";

export default function SuccessPanel({ orderNumber, stage, email }: {
  orderNumber: string; stage: number; email: string;
}) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    confetti({
      particleCount: 120,
      spread: 75,
      origin: { y: 0.25 },
      colors: ["#008060", "#004c3f", "#cdeee1", "#f59e0b"],
      disableForReducedMotion: true,
    });
  }, []);

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
        <p className="mt-2 text-[15px] leading-relaxed text-ink">
          Your name will be added to the contributors list for stage 2 group task, keep working on your individual task.
        </p>
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