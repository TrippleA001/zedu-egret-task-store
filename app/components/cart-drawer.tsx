import { Alert, Field, btnPrimary, btnSecondary, inputCls } from "./ui";
import type { SchemaField } from "../api/checkout/route";

export type CartProduct = {
  id: string;
  title: string;
  stage_number: number;
  submission_schema?: SchemaField[];
};

export default function CartDrawer({ cart, values, msg, busy, onValues, onClose, onRemove, onCheckout }: {
  cart: CartProduct; values: Record<string, string>; msg: string; busy: boolean;
  onValues: (v: Record<string, string>) => void;
  onClose: () => void; onRemove: () => void; onCheckout: () => void;
}) {
  // Empty schema = checkout disabled (the form lives on the product row;
  // admins configure it in /admin). The server enforces the same rule (422).
  const schema: SchemaField[] = Array.isArray(cart.submission_schema) ? cart.submission_schema : [];
  const ready =
    schema.length > 0 &&
    schema.every((f) => !f.required || String(values[f.key] || "").trim() !== "");
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
            <p className="mt-0.5 text-[13px] text-muted">Task {cart.stage_number} verification · zero-cost milestone</p>
          </div>
          {msg && <Alert kind="error">{msg}</Alert>}
          {schema.length === 0 ? (
            <Alert kind="info">
              This task has no submission form configured yet — checkout unlocks once the admin adds its form.
            </Alert>
          ) : (
            <>
              {schema.map((f) => (
                <Field key={f.key} label={f.label} hint={f.hint}>
                  <input
                    className={inputCls}
                    value={values[f.key] || ""}
                    onChange={(e) => onValues({ ...values, [f.key]: e.target.value })}
                    placeholder={f.hint || f.label}
                    inputMode="url"
                  />
                </Field>
              ))}
              <ul className="space-y-1.5 rounded-lg border border-line bg-white px-4 py-3 text-[13px] text-muted">
                <li>HTTPS only, no local or private hosts</li>
                <li>Links are validated when you place the order</li>
                <li>PR links must be merged (not open or unmerged)</li>
              </ul>
            </>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row">
          <button className={btnSecondary} onClick={onClose} disabled={busy}>Continue shopping</button>
          <button className={`${btnPrimary} flex-1`} disabled={busy || !ready} onClick={onCheckout}>
            {busy ? "Verifying..." : "Place order ($0.00)"}
          </button>
        </div>
        <div className="border-t border-line px-5 py-3">
          <button
            onClick={onRemove}
            disabled={busy}
            className="w-full text-center text-[13px] font-semibold text-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
          >
            Remove from cart
          </button>
        </div>
      </aside>
    </div>
  );
}