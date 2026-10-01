export function Field({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink">{label}</label>
      {hint && <p className="mt-0.5 text-[13px] text-muted">{hint}</p>}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export const inputCls =
  "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-[15px] text-ink placeholder:text-muted/60 shadow-sm transition hover:border-muted/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted";

export function Alert({ kind, children }: { kind: "error" | "success" | "info"; children: React.ReactNode }) {
  const map: Record<string, string> = {
    error: "border-danger/25 bg-danger-bg text-danger",
    success: "border-brand/25 bg-brand-tint text-brand-deep",
    info: "border-line bg-canvas text-ink",
  };
  return <p className={`rounded-lg border px-3 py-2 text-sm ${map[kind]}`}>{children}</p>;
}

export function Badge({ tone, children }: { tone: "open" | "done" | "locked"; children: React.ReactNode }) {
  const map: Record<string, string> = {
    open: "bg-brand-tint text-brand-deep ring-brand/30",
    done: "bg-canvas text-muted ring-line",
    locked: "bg-canvas text-muted ring-line",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${map[tone]}`}>
      {children}
    </span>
  );
}

export const btnPrimary =
  "inline-flex w-full sm:w-auto items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50";

export const btnSecondary =
  "inline-flex items-center justify-center rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition hover:border-muted/60 hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50";

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-1 sm:gap-2" aria-label="Progress">
      {steps.map((s, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={s} className="flex flex-1 items-center gap-2 last:flex-none">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ring-inset ${
                done
                  ? "bg-brand text-white ring-brand"
                  : active
                    ? "bg-brand-tint text-brand-deep ring-brand"
                    : "bg-white text-muted ring-line"
              }`}
            >
              {done ? "✓" : n}
            </span>
            <span className={`hidden text-[13px] font-medium sm:block ${active ? "text-ink" : "text-muted"}`}>{s}</span>
            {n < steps.length && <span className={`mx-1 h-px flex-1 ${done ? "bg-brand" : "bg-line"}`} />}
          </li>
        );
      })}
    </ol>
  );
}
