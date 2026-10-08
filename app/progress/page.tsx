"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-client";
import { NameCard } from "../components/name-card";

type Task = { stage_number: number; week_number: number; title: string };
type Member = { name: string; stages: number[] };

type Filter = { kind: "all" } | { kind: "week"; n: number } | { kind: "task"; n: number };

export default function ProgressPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sb = supabaseBrowser();
      const { data } = await sb.auth.getUser();
      if (!data.user) { router.replace("/login"); return; }
      const { data: prof } = await sb.from("users").select("id").eq("id", data.user.id).maybeSingle();
      if (!prof) { router.replace("/onboarding"); return; }
      const r = await fetch("/api/progress");
      if (r.ok) {
        const j = await r.json();
        setTasks(j.tasks || []);
        setMembers(j.members || []);
      }
      setLoading(false);
    })();
  }, [router]);

  const weeks = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.week_number))).sort((a, b) => a - b),
    [tasks]
  );

  const visibleTasks = useMemo(() => {
    if (filter.kind === "week") return tasks.filter((t) => t.week_number === filter.n);
    if (filter.kind === "task") return tasks.filter((t) => t.stage_number === filter.n);
    return tasks;
  }, [tasks, filter]);

  const summary = useMemo(() => {
    if (members.length === 0) return "";
    if (filter.kind === "task") {
      const passed = members.filter((m) => m.stages.includes(filter.n)).length;
      return `Task ${filter.n} — ${passed} of ${members.length} member${members.length === 1 ? "" : "s"} passed`;
    }
    if (filter.kind === "week") {
      const weekTasks = tasks.filter((t) => t.week_number === filter.n).map((t) => t.stage_number);
      const done = members.filter((m) => weekTasks.every((s) => m.stages.includes(s))).length;
      return `Week ${filter.n} — ${done} of ${members.length} member${members.length === 1 ? "" : "s"} finished`;
    }
    return `${members.length} member${members.length === 1 ? "" : "s"} · ${tasks.length} task${tasks.length === 1 ? "" : "s"}`;
  }, [members, tasks, filter]);

  const radio = (checked: boolean) =>
    `cursor-pointer rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${checked ? "bg-ink text-white" : "bg-white text-muted ring-1 ring-inset ring-line hover:text-ink"}`;

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="skeleton h-8 w-56" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <nav className="text-[13px] font-medium text-muted" aria-label="Breadcrumb">
        <Link href="/" className="text-muted">Home</Link> <span aria-hidden>/</span> <span className="text-ink">Progress</span>
      </nav>
      <div className="mt-4 border-b border-line pb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">Progress board</h1>
        <p className="mt-1 text-sm text-muted">{summary}</p>
      </div>

      <fieldset className="mt-6">
        <legend className="text-[13px] font-semibold uppercase tracking-widest text-muted">Filter</legend>
        <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Board filter">
          <label className={radio(filter.kind === "all")}>
            <input type="radio" name="board-filter" className="sr-only" checked={filter.kind === "all"} onChange={() => setFilter({ kind: "all" })} />
            All
          </label>
          {weeks.map((w) => (
            <label key={`w${w}`} className={radio(filter.kind === "week" && filter.n === w)}>
              <input type="radio" name="board-filter" className="sr-only" checked={filter.kind === "week" && filter.n === w} onChange={() => setFilter({ kind: "week", n: w })} />
              Week {w}
            </label>
          ))}
          {tasks.map((t) => (
            <label key={`t${t.stage_number}`} className={radio(filter.kind === "task" && filter.n === t.stage_number)} title={t.title}>
              <input type="radio" name="board-filter" className="sr-only" checked={filter.kind === "task" && filter.n === t.stage_number} onChange={() => setFilter({ kind: "task", n: t.stage_number })} />
              Task {t.stage_number}
            </label>
          ))}
        </div>
      </fieldset>

      {members.length === 0 ? (
        <p className="mt-8 rounded-xl border border-line bg-canvas px-4 py-6 text-center text-sm text-muted">
          No members yet.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <NameCard key={m.name} name={m.name} stages={m.stages} tasks={visibleTasks} />
          ))}
        </div>
      )}
    </div>
  );
}
