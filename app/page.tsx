"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-client";
import { isStagePurchasable, STAGE2_CLOSED_MSG } from "@/lib/store";
import { Alert, Badge, btnSecondary, inputCls } from "./components/ui";
import CartDrawer from "./components/cart-drawer";
import SuccessPanel from "./components/success-panel";

type Product = { id: string; title: string; description: string; price: string; stage_number: number };

export default function StorePage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [stages, setStages] = useState<number[]>([]);
  const [userId, setUserId] = useState("");
  const [cart, setCart] = useState<Product | null>(null);
  const [todoUrl, setTodoUrl] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState("");
  const [receiptEmail, setReceiptEmail] = useState("");

  useEffect(() => {
    (async () => {
      const sb = supabaseBrowser();
      const { data } = await sb.auth.getUser();
      if (!data.user) { router.replace("/login"); return; }
      setUserId(data.user.id);
      const { data: prof } = await sb.from("users").select("id").eq("id", data.user.id).maybeSingle();
      if (!prof) { router.replace("/onboarding"); return; }
      const rp = await fetch("/api/products").then((r) => r.json());
      if (rp.items) setProducts(rp.items);
      const ro = await fetch("/api/orders").then((r) => r.json());
      if (ro.stages) setStages(ro.stages);
    })();
  }, [router]);

  const unlocked = (stage: number) =>
    stage === 1 || stages.includes(stage - 1);

  const checkout = async () => {
    if (!cart) return;
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId, productId: cart.id, stageNumber: cart.stage_number,
          todoAppUrl: todoUrl, taskRepoUrl: repoUrl,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Checkout failed");
      setReceipt(j.order_number);
      setReceiptEmail(j.email || "skipped");
      setStages((s) => [...s, cart.stage_number]);
      setCart(null); setTodoUrl(""); setRepoUrl("");
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  const doneCount = stages.length;
  const totalCount = products.length || 1;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand">Task milestones</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Stage products</h1>
          <p className="mt-1 text-sm text-muted">
            {products.length} products · {doneCount} of {products.length} complete · $0.00 milestones.
          </p>
        </div>
        {products.length > 0 && (
          <div className="flex items-center gap-2 text-[13px] text-muted">
            <div className="h-2 w-40 overflow-hidden rounded-full bg-canvas ring-1 ring-inset ring-line">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.round((doneCount / totalCount) * 100)}%` }} />
            </div>
            {Math.round((doneCount / totalCount) * 100)}%
          </div>
        )}
      </div>
      {receipt && (
        <SuccessPanel orderNumber={receipt} stage={1} email={receiptEmail} />
      )}
      {products.length === 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
              <div className="skeleton h-36 !rounded-none" />
              <div className="space-y-2 p-5">
                <div className="skeleton h-4 w-2/3" />
                <div className="skeleton h-3 w-full" />
                <div className="skeleton h-8 w-28" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const done = stages.includes(p.stage_number);
            const open = unlocked(p.stage_number);
            const purchasable = isStagePurchasable(p.stage_number);
            return (
              <article key={p.id} className="flex flex-col overflow-hidden rounded-xl border border-line bg-white shadow-sm transition hover:shadow-md">
                <div className={`relative flex h-36 items-center justify-center ${done || open ? "bg-brand-tint" : "bg-canvas"}`}>
                  <span className={`text-6xl font-black tracking-tighter ${done || open ? "text-brand/20" : "text-muted/30"}`}>
                    {String(p.stage_number).padStart(2, "0")}
                  </span>
                  <span className="absolute left-4 top-4">
                    {done ? <Badge tone="done">Completed</Badge> : open ? (purchasable ? <Badge tone="open">Available</Badge> : <Badge tone="open">Unlocked</Badge>) : <Badge tone="locked">Locked</Badge>}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Zedu Egret · Stage {p.stage_number}</p>
                  <h3 className="mt-1 text-base font-bold text-ink">{p.title}</h3>
                  <p className="mt-1 line-clamp-3 text-sm text-muted">{p.description}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[15px] font-bold text-ink">${Number(p.price).toFixed(2)}</span>
                    <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[11px] font-bold text-brand-deep">Free</span>
                  </div>
                  <div className="mt-4">
                    {done ? (
                      <span className="inline-flex w-full items-center justify-center rounded-lg bg-canvas px-4 py-2.5 text-sm font-semibold text-muted">Completed</span>
                    ) : open && purchasable ? (
                      <button className="inline-flex w-full items-center justify-center rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-black" onClick={() => setCart(p)}>Add to cart</button>
                    ) : open ? (
                      <div>
                        <span className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg border border-line bg-canvas px-4 py-2.5 text-sm font-semibold text-muted" title={STAGE2_CLOSED_MSG}>
                          Add to cart — opening soon
                        </span>
                        <p className="mt-1.5 text-center text-[12px] text-muted">Complete your individual task. Group task opens soon.</p>
                      </div>
                    ) : (
                      <span className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg border border-line bg-canvas px-4 py-2.5 text-sm font-semibold text-muted">
                        Complete Stage {p.stage_number - 1} first
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {cart && (
        <CartDrawer
          cart={cart}
          todoUrl={todoUrl}
          repoUrl={repoUrl}
          msg={msg}
          busy={busy}
          onTodo={setTodoUrl}
          onRepo={setRepoUrl}
          onClose={() => !busy && setCart(null)}
          onCheckout={checkout}
        />
      )}
    </div>
  );
}
