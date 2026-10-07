import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase env config (single source; mirrors lib/supabase-server.ts serviceKey()).
function baseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  return url;
}

function anonKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return key;
}

function serviceKey() {
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    throw new Error(
      "Missing SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY)"
    );
  return key;
}

// Service-role client for privileged DB reads/writes (bypasses RLS).
export function serviceClient() {
  return createClient(baseUrl(), serviceKey());
}

// Resolve the caller's Supabase user id for user-scoped API routes.
// 1. Web: session cookies via @supabase/ssr (unchanged behaviour).
// 2. Mobile / external clients: `Authorization: Bearer <supabase access token>`
//    (verify with auth.getUser — never trust a raw userId from the body alone).
// Returns the user id or null when neither credential is present/valid.
export async function authUserId(
  request?: Request
): Promise<string | null> {
  const jar = cookies();
  const authed = createServerClient(baseUrl(), anonKey(), {
    cookies: { getAll: () => jar.getAll(), setAll: () => {} },
  });
  const { data } = await authed.auth.getUser();
  if (data?.user?.id) return data.user.id;

  const header = request?.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const direct = createClient(baseUrl(), anonKey());
  const { data: viaToken } = await direct.auth.getUser(token);
  return viaToken?.user?.id ?? null;
}

// Resolve the caller's full user (id + email). Same cookie-then-Bearer order.
export async function authUser(request?: Request): Promise<{
  id: string;
  email?: string;
} | null> {
  const jar = cookies();
  const authed = createServerClient(baseUrl(), anonKey(), {
    cookies: { getAll: () => jar.getAll(), setAll: () => {} },
  });
  const { data } = await authed.auth.getUser();
  if (data?.user?.id)
    return { id: data.user.id, email: data.user.email ?? undefined };

  const header = request?.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const direct = createClient(baseUrl(), anonKey());
  const { data: viaToken } = await direct.auth.getUser(token);
  if (!viaToken?.user?.id) return null;
  return { id: viaToken.user.id, email: viaToken.user.email ?? undefined };
}
