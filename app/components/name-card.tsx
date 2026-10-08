// Name card with progress tier: 0-1 tasks = gray, 2-3 = amber, all = green.
// Shared by the storefront header area, /profile, and the /progress board.
export type Tier = "gray" | "amber" | "green";

export function tierFor(passed: number, total: number): Tier {
  if (total > 0 && passed >= total) return "green";
  if (passed <= 1) return "gray";
  return "amber";
}

export const TIER_LABEL: Record<Tier, string> = {
  gray: "Getting started",
  amber: "On a roll",
  green: "All tasks done",
};

const TIER_BORDER: Record<Tier, string> = {
  gray: "border-line",
  amber: "border-warn/40",
  green: "border-brand/40",
};

const TIER_AVATAR: Record<Tier, string> = {
  gray: "bg-canvas text-muted",
  amber: "bg-warn/15 text-warn",
  green: "bg-brand-tint text-brand-deep",
};

const TIER_TEXT: Record<Tier, string> = {
  gray: "text-muted",
  amber: "text-warn",
  green: "text-brand-deep",
};

const TIER_DOT: Record<Tier, string> = {
  gray: "bg-muted/70",
  amber: "bg-warn",
  green: "bg-brand",
};

function nameInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "Z") + (parts[1]?.[0] || "")).toUpperCase();
}

export function NameCard({ name, stages, tasks, sub }: {
  name: string;
  stages: number[];
  tasks: Array<{ stage_number: number }>;
  sub?: string;
}) {
  const total = tasks.length;
  const tier = tierFor(stages.length, total);
  return (
    <article className={`flex items-center gap-3 rounded-xl border bg-white p-3 shadow-sm ${TIER_BORDER[tier]}`}>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${TIER_AVATAR[tier]}`}
        aria-hidden
      >
        {nameInitials(name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-bold text-ink" title={name}>{name}</p>
          <p className={`shrink-0 text-[12px] font-semibold ${TIER_TEXT[tier]}`}>
            {stages.length}/{total} · {TIER_LABEL[tier]}
          </p>
        </div>
        {sub && <p className="mt-0.5 truncate text-[12px] text-muted">{sub}</p>}
        {tasks.length > 0 && (
          <ul className="mt-1.5 flex flex-wrap items-center gap-1" aria-label="Tasks passed">
            {tasks.map((t) => {
              const done = stages.includes(t.stage_number);
              return (
                <li
                  key={t.stage_number}
                  title={`Task ${t.stage_number}${done ? " — passed" : ""}`}
                  className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                    done ? `${TIER_DOT[tier]} text-white` : "bg-canvas text-muted ring-1 ring-inset ring-line"
                  }`}
                >
                  {done ? "✓" : t.stage_number}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </article>
  );
}
