import { NextResponse } from "next/server";
import { isBlockedHost, isHttpsUrl, parseGithubRepo, generateOrderNumber } from "@/lib/validation";
import { fetchWithTimeout, sendReceiptEmail, triggerContributorsBuild } from "@/lib/side-effects";
import { STAGE2_CLOSED_MSG, isStagePurchasable } from "@/lib/store";
import { authUser, serviceClient } from "@/lib/api-auth";

export async function POST(request: Request) {
  try {
    const user = await authUser(request);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await request.json();
    const userId = String(body?.userId || "");
    const productId = String(body?.productId || "");
    const stageNumber = Number(body?.stageNumber);
    const todoAppUrl = String(body?.todoAppUrl || "").trim();
    const taskRepoUrl = String(body?.taskRepoUrl || "").trim();

    if (user.id !== userId) return NextResponse.json({ error: "userId mismatch" }, { status: 403 });
    if (!productId || !stageNumber || !todoAppUrl || !taskRepoUrl)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    if (!isHttpsUrl(todoAppUrl) || !isHttpsUrl(taskRepoUrl))
      return NextResponse.json({ error: "Both URLs must be https://" }, { status: 400 });

    let todoHost = "";
    try { todoHost = new URL(todoAppUrl).hostname; }
    catch { return NextResponse.json({ error: "Invalid todoAppUrl" }, { status: 400 }); }
    if (isBlockedHost(todoHost)) return NextResponse.json({ error: "todoAppUrl host not allowed" }, { status: 400 });

    const gh = parseGithubRepo(taskRepoUrl);
    if (!gh) return NextResponse.json({ error: "taskRepoUrl must be github.com/owner/repo" }, { status: 400 });

    const svc = serviceClient();
    const { data: product } = await svc.from("products").select("*").eq("id", productId).maybeSingle();
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    if (Number(product.stage_number) !== stageNumber)
      return NextResponse.json({ error: "stageNumber mismatch" }, { status: 400 });

    // Purchasable gate: Stage 2+ stays visible+unlocked but greyed out until opened.
    if (!isStagePurchasable(stageNumber))
      return NextResponse.json({ error: STAGE2_CLOSED_MSG }, { status: 423 });

    if (stageNumber > 1) {
      const { data: prev } = await svc.from("submissions").select("id")
        .eq("user_id", userId).eq("stage_number", stageNumber - 1).maybeSingle();
      if (!prev) return NextResponse.json({ error: `Stage ${stageNumber - 1} required first` }, { status: 423 });
    }
    const { data: dup } = await svc.from("submissions").select("id")
      .eq("user_id", userId).eq("stage_number", stageNumber).maybeSingle();
    if (dup) return NextResponse.json({ error: "Already submitted for this stage" }, { status: 409 });

    let appOk = false;
    try { appOk = (await fetchWithTimeout(todoAppUrl, 2000)).status === 200; }
    catch { appOk = false; }
    if (!appOk) return NextResponse.json({ error: "todoAppUrl not reachable (need HTTP 200)" }, { status: 422 });

    const pat = process.env.GITHUB_PAT || "";
    const ghRes = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}`, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(pat && !pat.includes("placeholder") ? { Authorization: `Bearer ${pat}` } : {}),
        "User-Agent": "zedu-egret-checkout/1.0",
      },
      signal: AbortSignal.timeout(2000),
    }).catch(() => null);
    if (!ghRes || ghRes.status === 404) return NextResponse.json({ error: "GitHub repo not found/private" }, { status: 422 });
    if (!ghRes.ok) return NextResponse.json({ error: `GitHub check failed (${ghRes.status})` }, { status: 422 });
    const repo = await ghRes.json();
    if (repo.private || repo.size === 0) return NextResponse.json({ error: "Repo must be public + non-empty" }, { status: 422 });

    const { error: sErr } = await svc.from("submissions").insert({
      user_id: userId, stage_number: stageNumber, todo_app_url: todoAppUrl, task_repo_url: taskRepoUrl,
    });
    if (sErr) {
      if (String(sErr.message).includes("duplicate")) return NextResponse.json({ error: "Already submitted" }, { status: 409 });
      throw sErr;
    }

    let orderNumber = generateOrderNumber();
    let orderId: string | null = null;
    for (let i = 0; i < 3; i++) {
      const { data, error } = await svc.from("orders")
        .insert({ user_id: userId, product_id: productId, status: "fulfilled", order_number: orderNumber })
        .select("id").single();
      if (!error) { orderId = data.id; break; }
      if (!String(error.message).includes("duplicate")) throw error;
      orderNumber = generateOrderNumber();
    }
    if (!orderId) throw new Error("Could not create order");

    const { data: prof } = await svc.from("users").select("auth_email, workspace_email, full_name").eq("id", userId).maybeSingle();

    // In-account notification (mirrors the email — sandbox domains only
    // deliver to authorized recipients, so the inbox is the real channel).
    const notifBody = prof
      ? `Hi ${prof.full_name || ""},\n\nYour Stage ${stageNumber} verification order ${orderNumber} is FULFILLED.\n\nYour name will be added to the contributors list for stage 2 group task, keep working on your individual task.\n\n— Zedu Egret Store`
      : `Your Stage ${stageNumber} verification order ${orderNumber} is FULFILLED.\n\nYour name will be added to the contributors list for stage 2 group task, keep working on your individual task.`;
    const { error: nErr } = await svc.from("notifications").insert({
      user_id: userId,
      kind: "order_fulfilled",
      title: `Stage ${stageNumber} complete — order ${orderNumber}`,
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
