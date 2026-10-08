"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, btnPrimary, btnSecondary, inputCls } from "@/app/components/ui";

export type SchemaDef = {
  key: string;
  label: string;
  hint?: string;
  type: "live_url" | "github_repo" | "drive_url" | "github_pr" | "text";
  required?: boolean;
};

export type AdminProduct = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  stage_number: number;
  week_number: number;
  is_active: boolean;
  is_open: boolean;
  submission_schema: SchemaDef[];
};

type FormState = {
  title: string;
  description: string;
  price: string;
  stage_number: string;
  week_number: string;
  is_active: boolean;
  is_open: boolean;
  schemaText: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  price: "0",
  stage_number: "",
  week_number: "1",
  is_active: true,
  is_open: false,
  schemaText: "",
};

function formFor(p: AdminProduct): FormState {
  return {
    title: p.title,
    description: p.description || "",
    price: String(p.price ?? 0),
    stage_number: String(p.stage_number),
    week_number: String(p.week_number ?? 1),
    is_active: p.is_active,
    is_open: p.is_open,
    schemaText: JSON.stringify(p.submission_schema || [], null, 2),
  };
}

export default function ProductManager({ products }: { products: AdminProduct[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const openNew = () => {
    setErr(""); setMsg(""); setForm(EMPTY_FORM); setEditing("new");
  };
  const openEdit = (p: AdminProduct) => {
    setErr(""); setMsg(""); setForm(formFor(p)); setEditing(p.id);
  };
  const close = () => { setEditing(null); setErr(""); };

  const save = async () => {
    setBusy(true); setErr("");
    try {
      let schema: unknown = [];
      if (form.schemaText.trim()) {
        try {
          schema = JSON.parse(form.schemaText);
        } catch {
          throw new Error("Submission schema is not valid JSON");
        }
      }
      const payload: Record<string, unknown> = {
        title: form.title,
        description: form.description,
        price: Number(form.price),
        stage_number: Number(form.stage_number),
        week_number: Number(form.week_number),
        is_active: form.is_active,
        is_open: form.is_open,
        submission_schema: schema,
      };
      const r = await fetch("/api/admin/products", {
        method: editing === "new" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing === "new" ? payload : { id: editing, ...payload }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `Save failed (${r.status})`);
      setMsg(editing === "new" ? "Product created." : "Product saved.");
      setEditing(null);
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (p: AdminProduct) => {
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await fetch("/api/admin/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, is_active: !p.is_active }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `Update failed (${r.status})`);
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleOpen = async (p: AdminProduct) => {
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await fetch("/api/admin/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, is_open: !p.is_open }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `Update failed (${r.status})`);
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Products">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-ink">Products</h2>
          <p className="mt-1 text-sm text-muted">
            Task catalog rows, their submission forms, and the open/closed checkout gate.
          </p>
        </div>
        {editing === null && (
          <button type="button" className={btnSecondary} onClick={openNew}>Add product</button>
        )}
      </div>
      {err && <div className="mt-3"><Alert kind="error">{err}</Alert></div>}
      {msg && <div className="mt-3"><Alert kind="success">{msg}</Alert></div>}

      {editing !== null && (
        <div className="mt-4 rounded-xl border border-line bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-bold text-ink">{editing === "new" ? "New product" : "Edit product"}</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-ink">Title</span>
              <input className={`${inputCls} mt-1.5`} value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Task 6 Verification" />
            </label>
            <label>
              <span className="block text-sm font-medium text-ink">Task number</span>
              <input className={`${inputCls} mt-1.5`} type="number" min={1} max={99} value={form.stage_number} onChange={(e) => set({ stage_number: e.target.value })} placeholder="6" />
            </label>
            <label>
              <span className="block text-sm font-medium text-ink">Week number</span>
              <input className={`${inputCls} mt-1.5`} type="number" min={1} max={99} value={form.week_number} onChange={(e) => set({ week_number: e.target.value })} />
            </label>
            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-ink">Description</span>
              <input className={`${inputCls} mt-1.5`} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Task 6 milestone …" />
            </label>
            <label>
              <span className="block text-sm font-medium text-ink">Price</span>
              <input className={`${inputCls} mt-1.5`} type="number" min={0} step="0.01" value={form.price} onChange={(e) => set({ price: e.target.value })} />
            </label>
            <label className="flex items-end gap-2 pb-2.5">
              <input type="checkbox" checked={form.is_active} onChange={(e) => set({ is_active: e.target.checked })} className="h-4 w-4 accent-[var(--color-brand,#008060)]" />
              <span className="text-sm font-medium text-ink">Active (visible in catalog)</span>
            </label>
            <label className="flex items-end gap-2 pb-2.5">
              <input type="checkbox" checked={form.is_open} onChange={(e) => set({ is_open: e.target.checked })} className="h-4 w-4 accent-[var(--color-brand,#008060)]" />
              <span className="text-sm font-medium text-ink">Open (purchasable in checkout)</span>
            </label>
            <label className="sm:col-span-2 lg:col-span-4">
              <span className="block text-sm font-medium text-ink">Submission schema (JSON)</span>
              <span className="mt-0.5 block text-[12px] text-muted">
                Drives the checkout form. Field types: live_url, github_repo, drive_url, github_pr, text.
              </span>
              <textarea
                className={`${inputCls} mt-1.5 font-mono text-[13px]`}
                rows={8}
                spellCheck={false}
                value={form.schemaText}
                onChange={(e) => set({ schemaText: e.target.value })}
                placeholder={'[{"key":"deployed_url","label":"Deployed app URL","type":"live_url","required":true}]'}
              />
            </label>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button type="button" className={btnPrimary} disabled={busy || !form.title.trim() || !form.stage_number} onClick={() => void save()}>
              {busy ? "Saving…" : editing === "new" ? "Create product" : "Save changes"}
            </button>
            <button type="button" className={btnSecondary} disabled={busy} onClick={close}>Cancel</button>
          </div>
        </div>
      )}

      <ul className="mt-4 grid gap-3 lg:grid-cols-2">
        {products.map((p) => (
          <li key={p.id} className="rounded-xl border border-line bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Task {p.stage_number} · Week {p.week_number ?? 1}</p>
                <h3 className="mt-0.5 truncate text-sm font-bold text-ink" title={p.title}>{p.title}</h3>
                <p className="mt-1 truncate text-[13px] text-muted" title={p.description || undefined}>{p.description || "No description"}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge tone={p.is_open ? "open" : "locked"}>{p.is_open ? "Open" : "Closed"}</Badge>
                <Badge tone={p.is_active ? "open" : "locked"}>{p.is_active ? "Active" : "Hidden"}</Badge>
              </div>
            </div>
            <p className="mt-2 truncate text-[12px] text-muted">
              {(p.submission_schema || []).length > 0
                ? `Form: ${(p.submission_schema || []).map((f) => f.key).join(", ")}`
                : "No form configured — checkout disabled"}
            </p>
            {editing !== p.id && (
              <div className="mt-3 flex items-center gap-3">
                <button type="button" className="text-[13px] font-semibold text-brand hover:underline" onClick={() => openEdit(p)}>Edit</button>
                <button type="button" disabled={busy} className="text-[13px] font-semibold text-muted hover:text-ink hover:underline disabled:opacity-50" onClick={() => void toggleOpen(p)}>
                  {p.is_open ? "Close checkout" : "Open checkout"}
                </button>
                <button type="button" disabled={busy} className="text-[13px] font-semibold text-muted hover:text-ink hover:underline disabled:opacity-50" onClick={() => void toggleActive(p)}>
                  {p.is_active ? "Hide from catalog" : "Show in catalog"}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
