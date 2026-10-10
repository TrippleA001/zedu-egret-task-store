import { NextResponse } from "next/server";
import { isBlockedHost, isHttpsUrl, parseDriveUrl, parseGithubPr, parseGithubRepo, generateOrderNumber } from "@/lib/validation";
import { fetchWithTimeout, sendReceiptEmail, triggerContributorsBuild } from "@/lib/side-effects";
import { authUser, serviceClient } from "@/lib/api-auth";
import { requiredStages } from "@/lib/policy";

export type SchemaField = {
  key: string;
  label: string;
  hint?: string;
  type: "live_url" | "github_repo" | "drive_url" | "github_pr" | "text";
  required?: boolean;
};

function githubHeaders(): Record<string, string> {
  const pat = process.env.GITHUB_PAT || "";
  return {
    Accept: "application/vnd.github+json",
    ...(pat && !pat.includes("placeholder") ? { Authorization: `Bearer ${pat}` } : {}),
    "User-Agent": "zedu-egret-checkout/1.0",
  };
}

/** Validate one schema field value. Returns an error string or null (valid). */
async function validateSubmissionField(field: SchemaField, raw: string): Promise<string | null> {
  const label = field.label || field.key;
  switch (field.type) {
    case "live_url": {
      if (!isHttpsUrl(raw)) return `${label} must be an https:// URL`;
      let host = "";
      try {
        host = new URL(raw).hostname;
      } catch {
        return `${label} is not a valid URL`;
      }
      if (isBlockedHost(host)) return `${label} host is not allowed`;
      let ok = false;
      try {
        ok = (await fetchWithTimeout(raw, 2000)).status === 200;
      } catch {
        ok = false;
      }
      if (!ok) return `${label} is not reachable (need HTTP 200)`;
      return null;
    }
    case "github_repo": {
      const gh = parseGithubRepo(raw);
      if (!gh) return `${label} must be github.com/owner/repo`;
      const res = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}`, {
        headers: githubHeaders(),
        signal: AbortSignal.timeout(2000),
      }).catch(() => null);
      if (!res || res.status === 404) return `${label}: repo not found or private`;
      if (!res.ok) return `${label}: GitHub check failed (${res.status})`;
      const repo = await res.json();
      if (repo.private || repo.size === 0) return `${label}: repo must be public + non-empty`;
      return null;
    }
    case "drive_url": {
      if (!isHttpsUrl(raw) || !parseDriveUrl(raw))
        return `${label} must be a Google Drive link (drive.google.com or docs.google.com)`;
      let ok = false;
      try {
        ok = (await fetchWithTimeout(raw, 2000)).status < 400;
      } catch {
        ok = false;
      }
      if (!ok) return `${label} is not reachable`;
      return null;
    }
    case "github_pr": {
      const pr = parseGithubPr(raw);
      if (!pr) return `${label} must be a GitHub pull request link (…/owner/repo/pull/N)`;
      const res = await fetch(`https://api.github.com/repos/${pr.owner}/${pr.repo}/pulls/${pr.number}`, {
        headers: githubHeaders(),
        signal: AbortSignal.timeout(2000),
      }).catch(() => null);
      if (!res || res.status === 404) return `${label}: pull request not found`;
      if (!res.ok) return `${label}: GitHub check failed (${res.status})`;
      const data = await res.json();
      // Accept ONLY merged PRs: open, closed-unmerged, and draft are rejected.
      if (data.state === "open") return `${label}: PR #${pr.number} is still open — it must be merged`;
      if (!data.merged_at) return `${label}: PR #${pr.number} was closed without merging — it must be merged`;
      return null;
    }
    case "text":
    default:
      return null;
  }
}

export async function POST(request: Request) {
  try {
    const user = await authUser(request);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await request.json();
    const userId = String(body?.userId || "");
    const productId = String(body?.productId || "");
    // New clients send taskNumber + values; the old stageNumber/todoAppUrl/
    // taskRepoUrl body still works and is mapped onto the Task 1 schema.
    const stageNumber = Number(body?.stageNumber ?? body?.taskNumber);
    const legacyValues = {
      deployed_url: String(body?.todoAppUrl || "").trim(),
      github_repo: String(body?.taskRepoUrl || "").trim(),
    };
    const values: Record<string, string> = {};
    if (body?.values && typeof body.values === "object") {
      for (const [k, v] of Object.entries(body.values)) {
        values[String(k)] = String(v ?? "").trim();
      }
    } else if (legacyValues.deployed_url || legacyValues.github_repo) {
      Object.assign(values, legacyValues);
    }

    if (user.id !== userId) return NextResponse.json({ error: "userId mismatch" }, { status: 403 });
    if (!productId || !stageNumber)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const svc = serviceClient();
    const { data: product } = await svc.from("products").select("*").eq("id", productId).maybeSingle();
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    if (Number(product.stage_number) !== stageNumber)
      return NextResponse.json({ error: "stageNumber mismatch" }, { status: 400 });

    // Purchasable gate: tasks stay visible+unlocked but greyed out until
    // opened (products.is_open, toggled from /admin).
    if (!product.is_open)
      return NextResponse.json(
        { error: "This task is not open yet — it unlocks when announced." },
        { status: 423 },
      );

    // Prereq gate: every stage listed in products.prereq_stages must have a
    // current submission in this org; empty config keeps the N-1 default.
    const required = requiredStages(product.prereq_stages, stageNumber);
    if (required.length > 0) {
      const { data: done } = await svc.from("submissions").select("stage_number")
        .eq("user_id", userId).eq("org_id", product.org_id).eq("is_current", true)
        .in("stage_number", required);
      const have = new Set((done || []).map((r: { stage_number: number }) => r.stage_number));
      const missing = required.filter((s) => !have.has(s));
      if (missing.length > 0) {
        const list = missing.join(", ");
        return NextResponse.json(
          {
            error: missing.length === 1
              ? `Task ${list} required first`
              : `Tasks ${list} required first`,
          },
          { status: 423 },
        );
      }
    }

    // Attempt policy: 'single' keeps the historic one-submission rule (409);
    // 'multiple' lets every checkout save a new attempt (history preserved).
    const multiple = product.attempts_policy === "multiple";
    if (!multiple) {
      const { data: dup } = await svc.from("submissions").select("id")
        .eq("user_id", userId).eq("org_id", product.org_id).eq("stage_number", stageNumber).maybeSingle();
      if (dup) return NextResponse.json({ error: "Already submitted for this task" }, { status: 409 });
    }

    // Schema-driven field validation (driven by the product's
    // submission_schema; required keys must all be present + valid).
    const schema: SchemaField[] = Array.isArray(product.submission_schema)
      ? product.submission_schema
      : [];
    // No form configured = nothing to verify against, so refuse checkout
    // instead of accepting an empty submission (mirrors the drawer UI).
    if (schema.length === 0)
      return NextResponse.json({ error: "This task has no submission form configured yet" }, { status: 422 });
    const required = schema.filter((f) => f && f.required !== false && f.key);
    for (const field of required) {
      const raw = String(values[field.key] || "");
      if (!raw) return NextResponse.json({ error: `${field.label || field.key} is required` }, { status: 400 });
      const fail = await validateSubmissionField(field, raw);
      if (fail) return NextResponse.json({ error: fail }, { status: 422 });
    }

    // Legacy column mirror (kept for Stage-1 tooling reading todo_app_url /
    // task_repo_url). Task 3-style schemas store everything in values only.
    const todoAppUrl = String(values.deployed_url || values.todoAppUrl || "");
    const taskRepoUrl = String(values.github_repo || values.mobile_repo || values.taskRepoUrl || "");

    // Multiple attempts: number the new row and retire the previous current
    // one. The flip happens before the insert, so a failed insert restores
    // it — a validation error must not leave the task looking incomplete.
    let attemptNumber = 1;
    if (multiple) {
      const { data: last } = await svc.from("submissions").select("attempt_number")
        .eq("user_id", userId).eq("org_id", product.org_id).eq("stage_number", stageNumber)
        .order("attempt_number", { ascending: false }).limit(1).maybeSingle();
      attemptNumber = (last?.attempt_number ?? 0) + 1;
      const { error: curErr } = await svc.from("submissions").update({ is_current: false })
        .eq("user_id", userId).eq("org_id", product.org_id).eq("stage_number", stageNumber)
        .eq("is_current", true);
      if (curErr) throw curErr;
    }

    const { error: sErr } = await svc.from("submissions").insert({
      user_id: userId, org_id: product.org_id, stage_number: stageNumber,
      todo_app_url: todoAppUrl, task_repo_url: taskRepoUrl, values,
      attempt_number: attemptNumber, is_current: true,
    });
    if (sErr) {
      if (multiple) {
        await svc.from("submissions").update({ is_current: true })
          .eq("user_id", userId).eq("org_id", product.org_id).eq("stage_number", stageNumber)
          .eq("attempt_number", attemptNumber - 1)
          .then(({ error }) => { if (error) console.error("[submissions:current-restore-failed]", error.message); });
      }
      if (String(sErr.message).includes("duplicate")) return NextResponse.json({ error: "Already submitted" }, { status: 409 });
      throw sErr;
    }

    let orderNumber = generateOrderNumber();
    let orderId: string | null = null;
    for (let i = 0; i < 3; i++) {
      const { data, error } = await svc.from("orders")
        .insert({ user_id: userId, org_id: product.org_id, product_id: productId, status: "fulfilled", order_number: orderNumber })
        .select("id").single();
      if (!error) { orderId = data.id; break; }
      if (!String(error.message).includes("duplicate")) throw error;
      orderNumber = generateOrderNumber();
    }
    if (!orderId) throw new Error("Could not create order");

    const { data: prof } = await svc.from("users").select("auth_email, workspace_email, full_name").eq("id", userId).maybeSingle();

    // In-account notification (mirrors the email — sandbox domains only
    // deliver to authorized recipients, so the inbox is the real channel).
    const attemptSuffix = attemptNumber > 1 ? ` (attempt ${attemptNumber})` : "";
    const notifBody = prof
      ? `Hi ${prof.full_name || ""},\n\nYour Task ${stageNumber} verification order ${orderNumber} is FULFILLED.${attemptSuffix}\n\nYour name will be added to the contributors list for the group task, keep working on your individual task.\n\n— Zedu Egret Store`
      : `Your Task ${stageNumber} verification order ${orderNumber} is FULFILLED.${attemptSuffix}\n\nYour name will be added to the contributors list for the group task, keep working on your individual task.`;
    const { error: nErr } = await svc.from("notifications").insert({
      user_id: userId,
      kind: "order_fulfilled",
      title: `Task ${stageNumber} complete — order ${orderNumber}${attemptSuffix}`,
      body: notifBody,
      order_number: orderNumber,
    });
    if (nErr) console.error("[notifications:insert-failed]", nErr.message);

    let email: "sent" | "skipped" | "failed" = "skipped";
    if (prof) email = await sendReceiptEmail(prof.auth_email, prof.workspace_email, orderNumber, stageNumber);
    triggerContributorsBuild({ event_type: "contributor-update", client_payload: { user_id: userId, stage_number: stageNumber, order_number: orderNumber } });

    return NextResponse.json({ ok: true, orderId, order_number: orderNumber, email });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "checkout failed" }, { status: 500 });
  }
}
