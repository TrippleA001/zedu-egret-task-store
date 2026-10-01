import { Alert, Field, btnPrimary, btnSecondary, inputCls } from "./ui";

export type CartProduct = { id: string; title: string; stage_number: number };

export default function CartDrawer({ cart, todoUrl, repoUrl, msg, busy, onTodo, onRepo, onClose, onCheckout }: {
  cart: CartProduct; todoUrl: string; repoUrl: string; msg: string; busy: boolean;
  onTodo: (v: string) => void; onRepo: (v: string) => void;
  onClose: () => void; onCheckout: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Checkout ${cart.title}`}>
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Checkout</p>
            <h2 className="text-base font-bold text-ink">{cart.title}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg border border-line px-2.5 py-1.5 text-sm font-semibold text-muted hover:bg-canvas" aria-label="Close checkout">X</button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div className="rounded-lg border border-line bg-canvas px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink">{cart.title}</span>
              <span className="font-bold text-ink">$0.00</span>
            </div>
            <p className="mt-0.5 text-[13px] text-muted">Stage {cart.stage_number} verification · zero-cost milestone</p>
          </div>
          {msg && <Alert kind="error">{msg}</Alert>}
          <Field label="Deployed ToDo app URL" hint="https only, must return HTTP 200.">
            <input className={inputCls} value={todoUrl} onChange={(e) => onTodo(e.target.value)} placeholder="https://your-todo-app.vercel.app" inputMode="url" />
          </Field>
          <Field label="Task GitHub repo URL" hint="Public, non-empty github.com/owner/repo.">
            <input className={inputCls} value={repoUrl} onChange={(e) => onRepo(e.target.value)} placeholder="https://github.com/you/task-repo" inputMode="url" />
          </Field>
          <ul className="space-y-1.5 rounded-lg border border-line bg-white px-4 py-3 text-[13px] text-muted">
            <li>HTTPS only, no local or private hosts</li>
            <li>App must return HTTP 200 (2s check)</li>
            <li>Repo must be public and non-empty</li>
          </ul>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row">
          <button className={btnSecondary} onClick={onClose} disabled={busy}>Continue shopping</button>
          <button className={`${btnPrimary} flex-1`} disabled={busy || !todoUrl || !repoUrl} onClick={onCheckout}>
            {busy ? "Verifying..." : "Place order ($0.00)"}
          </button>
        </div>
      </aside>
    </div>
  );
}