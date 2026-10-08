"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge } from "@/app/components/ui";

export type AdminRequest = {
  id: string;
  field: string;
  old_value: string;
  new_value: string;
  note: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  decided_at: string | null;
  member_name: string;
};

const FIELD_LABELS: Record<string, string> = {
  full_name: "Full name",
  github_url: "GitHub URL",
  telegram_handle: "Telegram display name",
  skill_rating: "Skill rating",
};

export default function RequestQueue({ requests }: { requests: AdminRequest[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const decide = async (id: string, action: "approve" | "reject") => {
    setBusyId(id);
    setErr("");
    setMsg("");
    try {
      const r = await fetch("/api/admin/change-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `Decision failed (${r.status})`);
      setMsg(action === "approve" ? "Approved — the member's profile is updated." : "Request rejected.");
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const pending = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending");

  return (
    <section aria-label="Change requests">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-ink">Change requests</h2>
          <p className="mt-1 text-sm text-muted">
            Profile edits from members. Approving applies the change to their profile immediately.
          </p>
        </div>
        {pending.length > 0 && <Badge tone="open">{pending.length} pending</Badge>}
      </div>
      {err && <div className="mt-3"><Alert kind="error">{err}</Alert></div>}
      {msg && <div className="mt-3"><Alert kind="success">{msg}</Alert></div>}

      {pending.length === 0 ? (
        <p className="mt-4 rounded-xl border border-line bg-white px-4 py-6 text-center text-sm text-muted shadow-sm">
          No pending requests. Members submit these from their profile page.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 lg:grid-cols-2">
          {pending.map((r) => (
            <li key={r.id} className="rounded-xl border border-line bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink" title={r.member_name}>{r.member_name}</p>
                  <p className="text-[12px] text-muted">
                    {FIELD_LABELS[r.field] ?? r.field} · {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge tone="open">Pending</Badge>
              </div>
              <p className="mt-2 truncate text-[13px] text-muted" title={`${r.old_value} → ${r.new_value}`}>
                <span className="line-through">{r.old_value || "—"}</span>
                {" → "}
                <span className="font-semibold text-ink">{r.new_value}</span>
              </p>
              {r.note && <p className="mt-1 truncate text-[12px] italic text-muted" title={r.note}>“{r.note}”</p>}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => void decide(r.id, "approve")}
                  className="inline-flex items-center rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyId === r.id ? "Working…" : "Approve"}
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => void decide(r.id, "reject")}
                  className="inline-flex items-center rounded-lg border border-line bg-white px-3.5 py-2 text-[13px] font-semibold text-danger shadow-sm transition hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {decided.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-white shadow-sm">
          {decided.slice(0, 8).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <span className="min-w-0 truncate text-muted">
                <span className="font-semibold text-ink">{r.member_name}</span> · {FIELD_LABELS[r.field] ?? r.field} → {r.new_value}
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="text-[12px] text-muted">
                  {new Date(r.decided_at || r.created_at).toLocaleDateString()}
                </span>
                <Badge tone={r.status === "approved" ? "open" : "locked"}>
                  {r.status === "approved" ? "Approved" : "Rejected"}
                </Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
