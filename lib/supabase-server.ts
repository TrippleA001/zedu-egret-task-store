import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Next 14's Data Cache stores fetch() GETs by default — including the GETs
// supabase-js issues from server code — so a read can be answered from a
// stale entry without ever reaching Supabase, and the entry survives deploys.
// A route's `Cache-Control: no-store` response header does NOT prevent this;
// the fetch itself must opt out. Shared by every server-side client below.
export const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: "no-store" });

export const supabaseNoStore = { global: { fetch: noStoreFetch } };

export function supabaseServer() {
  const store = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} }, ...supabaseNoStore }
  );
}

// New Supabase projects issue `sb_secret_...` (SUPABASE_SECRET_KEY) instead of
// the legacy `eyJ...service_role` JWT. Both work here — prefer the new one.
export function serviceKey() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY)");
  return key;
}

export function supabaseService() {
  const { createClient } = require("@supabase/supabase-js");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey(), supabaseNoStore);
}

