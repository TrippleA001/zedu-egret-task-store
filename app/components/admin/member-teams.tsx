"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/app/components/ui";

export type AdminMember = {
  id: string;
  full_name: string;
  auth_email: string;
  workspace_email: string | null;
  sub_team: string | null;
};

export default function MemberTeams({ members }: { members: AdminMember[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.full_name.toLowerCase().includes(q) ||
        m.auth_email.toLowerCase().includes(q) ||
        (m.workspace_email || "").toLowerCase().includes(q) ||
        (m.sub_team || "").toLowerCase().includes(q)
    );
  }, [members, query]);

  const draftFor = (m: AdminMember) => drafts[m.id] ?? m.sub_team ?? "";
  const dirty = (m: AdminMember) => draftFor(m).trim() !== (m.sub_team || "");

  const save = async (m: AdminMember) => {
    setBusyId(m.id);
    setErr("");
    setMsg("");
    try {
      const r = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: m.id, sub_team: draftFor(m) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `Save failed (${r.status})`);
      setMsg(`${m.full_name}: sub-team ${j.member?.sub_team ? `set to “${j.member.sub_team}”` : "cleared"}.`);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[m.id];
        return next;
      });
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section aria-label="Member sub-teams">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-ink">Sub-teams</h2>
          <p className="mt-1 text-sm text-muted">
            Assign members to sub-teams. Free text — e.g. “Frontend”, “Backend”, “Data”.
          </p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search members…"
          aria-label="Search members"
          className="w-full max-w-xs rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
      </div>
      {err && <div className="mt-3"><Alert kind="error">{err}</Alert></div>}
      {msg && <div className="mt-3"><Alert kind="success">{msg}</Alert></div>}

      <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-white shadow-sm">
        {filtered.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1 basis-48">
              <p className="truncate text-sm font-semibold text-ink" title={m.full_name}>{m.full_name}</p>
              <p className="truncate text-[12px] text-muted" title={m.workspace_email || m.auth_email}>
                {m.workspace_email || m.auth_email}
              </p>
            </div>
            <div className="w-full max-w-[240px]">
              <input
                type="text"
                value={draftFor(m)}
                maxLength={100}
                placeholder="No sub-team"
                aria-label={`Sub-team for ${m.full_name}`}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [m.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && dirty(m) && busyId !== m.id) void save(m);
                }}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
            {dirty(m) && (
              <button
                type="button"
                disabled={busyId === m.id}
                onClick={() => void save(m)}
                className="inline-flex shrink-0 items-center rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyId === m.id ? "Saving…" : "Save"}
              </button>
            )}
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted">
            {members.length === 0 ? "No members yet." : "No members match that search."}
          </li>
        )}
      </ul>
    </section>
  );
}
