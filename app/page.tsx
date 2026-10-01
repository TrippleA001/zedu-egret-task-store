"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-client";

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
      setStages((s) => [...s, cart.stage_number]);
      setCart(null); setTodoUrl(""); setRepoUrl("");
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  return (
    <main className="container">
      <h1>Zedu Egret Store</h1>
      <p className="muted">Catalog -&gt; Cart -&gt; Checkout -&gt; Receipt. Milestones are $0.00 products.</p>
      {receipt && <p className="success">Order {receipt} fulfilled! Receipt emailed to you.</p>}
      <div className="grid grid-2">
        {products.map((p) => {
          const done = stages.includes(p.stage_number);
          const open = unlocked(p.stage_number);
          return (
            <div key={p.id} className={`card ${open ? "" : "locked"}`}>
              <h3>{p.title}</h3>
              <p className="muted">{p.description}</p>
              <p><b>${Number(p.price).toFixed(2)}</b> · Stage {p.stage_number}</p>
              {done ? <p className="success">Completed ✓</p> : open ? (
                <button className="btn" onClick={() => setCart(p)}>Add to Cart</button>
              ) : <p className="muted">Locked — complete Stage {p.stage_number - 1} first</p>}
            </div>
          );
        })}
      </div>
      {cart && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Checkout — {cart.title}</h2>
          {msg && <p className="error">{msg}</p>}
          <label>Deployed ToDo app URL (https, must return 200)</label>
          <input value={todoUrl} onChange={(e) => setTodoUrl(e.target.value)} placeholder="https://your-todo-app.vercel.app" />
          <label>Task GitHub repo URL (public, non-empty)</label>
          <input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/you/task-repo" />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setCart(null)}>Cancel</button>
            <button className="btn" disabled={busy || !todoUrl || !repoUrl} onClick={checkout}>
              {busy ? "Verifying..." : "Place Order ($0.00)"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
