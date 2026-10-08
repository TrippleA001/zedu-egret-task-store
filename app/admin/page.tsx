import Link from "next/link";
import { redirect } from "next/navigation";
import { authUser, isAdminUser, serviceClient } from "@/lib/api-auth";
import RequestQueue, { type AdminRequest } from "@/app/components/admin/request-queue";
import ProductManager, { type AdminProduct, type SchemaDef } from "@/app/components/admin/product-manager";
import { btnPrimary } from "@/app/components/ui";

export const dynamic = "force-dynamic";

type SubmissionRow = {
  id: string;
  stage_number: number;
  todo_app_url: string | null;
  task_repo_url: string | null;
  values: Record<string, string> | null;
  verified_at: string;
  users: { full_name?: string; auth_email?: string; workspace_email?: string } | Array<{ full_name?: string; auth_email?: string; workspace_email?: string }> | null;
};

type RequestRow = {
  id: string;
  field: string;
  old_value: string;
  new_value: string;
  note: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  decided_at: string | null;
  users: { full_name?: string } | Array<{ full_name?: string }> | null;
};

function joinUser<T>(u: T | T[] | null): T | null {
  return Array.isArray(u) ? u[0] ?? null : u ?? null;
}

function isHttps(v: string) {
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}

export default async function AdminPage() {
  const user = await authUser();
  if (!user) redirect("/login");

  if (!(await isAdminUser(user.id))) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">Admin access required</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          This console is limited to team leads. If you should have access, ask a lead to promote your account.
        </p>
        <Link href="/" className={`${btnPrimary} mt-6`}>Back to catalog</Link>
      </div>
    );
  }

  const svc = serviceClient();
  const [{ data: products }, { data: submissions }, { data: requests }] = await Promise.all([
    svc.from("products").select("*").order("stage_number"),
    svc
      .from("submissions")
      .select("id, stage_number, todo_app_url, task_repo_url, values, verified_at, users(full_name, auth_email, workspace_email)")
      .order("verified_at", { ascending: false })
      .limit(300),
    svc
      .from("change_requests")
      .select("id, field, old_value, new_value, note, status, created_at, decided_at, users(full_name)")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const adminProducts: AdminProduct[] = (products || []).map((p: Record<string, any>) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    price: Number(p.price ?? 0),
    stage_number: p.stage_number,
    week_number: p.week_number ?? 1,
    is_active: p.is_active !== false,
    submission_schema: Array.isArray(p.submission_schema) ? p.submission_schema : [],
  }));
  const schemaFor = (stage: number): SchemaDef[] =>
    adminProducts.find((p) => p.stage_number === stage)?.submission_schema || [];

  const adminRequests: AdminRequest[] = (requests || []).map((r: RequestRow) => ({
    id: r.id,
    field: r.field,
    old_value: r.old_value,
    new_value: r.new_value,
    note: r.note,
    status: r.status,
    created_at: r.created_at,
    decided_at: r.decided_at,
    member_name: joinUser(r.users)?.full_name || "Unknown member",
  }));

  const pendingCount = adminRequests.filter((r) => r.status === "pending").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <nav className="text-[13px] font-medium text-muted" aria-label="Breadcrumb">
        <Link href="/" className="text-muted">Home</Link> <span aria-hidden>/</span> <span className="text-ink">Admin</span>
      </nav>
      <div className="mt-4 border-b border-line pb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">Admin console</h1>
        <p className="mt-1 text-sm text-muted">
          {pendingCount > 0 ? `${pendingCount} change request${pendingCount === 1 ? "" : "s"} waiting for review.` : "Catalog, submissions and profile change requests."}
        </p>
      </div>

      <div className="mt-8 space-y-12">
        <RequestQueue requests={adminRequests} />
        <ProductManager products={adminProducts} />

        <section aria-label="All submissions">
          <h2 className="text-lg font-extrabold tracking-tight text-ink">Submissions</h2>
          <p className="mt-1 text-sm text-muted">Latest {(submissions || []).length} verified submissions across all tasks.</p>
          <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas/60 text-[12px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-semibold">Member</th>
                  <th className="px-4 py-3 font-semibold">Task</th>
                  <th className="px-4 py-3 font-semibold">Submitted</th>
                  <th className="px-4 py-3 font-semibold">Links</th>
                </tr>
              </thead>
              <tbody>
                {(submissions || []).map((s: SubmissionRow) => {
                  const u = joinUser(s.users);
                  const schema = schemaFor(s.stage_number);
                  const chips: Array<{ label: string; value: string }> = [];
                  for (const f of schema) {
                    const v = String(s.values?.[f.key] || "").trim();
                    if (v) chips.push({ label: f.label || f.key, value: v });
                  }
                  if (chips.length === 0) {
                    if (s.todo_app_url) chips.push({ label: "Deployed app", value: s.todo_app_url });
                    if (s.task_repo_url) chips.push({ label: "Task repo", value: s.task_repo_url });
                  }
                  return (
                    <tr key={s.id} className="border-b border-line last:border-0 align-top">
                      <td className="max-w-[220px] px-4 py-3">
                        <p className="truncate font-semibold text-ink" title={u?.full_name || undefined}>{u?.full_name || "Unknown"}</p>
                        <p className="truncate text-[12px] text-muted" title={u?.workspace_email || u?.auth_email || undefined}>
                          {u?.workspace_email || u?.auth_email || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">Task {s.stage_number}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[13px] text-muted">
                        {new Date(s.verified_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {chips.length === 0 ? (
                          <span className="text-[13px] text-muted">—</span>
                        ) : (
                          <ul className="flex flex-wrap gap-1.5">
                            {chips.map((c, i) =>
                              isHttps(c.value) ? (
                                <li key={`${c.label}-${i}`}>
                                  <a
                                    href={c.value}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex max-w-[220px] items-center rounded-full bg-brand-tint px-2.5 py-1 text-[12px] font-medium text-brand-deep transition hover:underline"
                                    title={c.value}
                                  >
                                    <span className="truncate">{c.label} ↗</span>
                                  </a>
                                </li>
                              ) : (
                                <li key={`${c.label}-${i}`} className="inline-flex max-w-[220px] items-center rounded-full bg-canvas px-2.5 py-1 text-[12px] font-medium text-muted ring-1 ring-inset ring-line">
                                  <span className="truncate" title={c.value}>{c.label}: {c.value}</span>
                                </li>
                              )
                            )}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {(submissions || []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted">No submissions yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
