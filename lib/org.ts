import { serviceClient } from "@/lib/api-auth";

// Slug of the org everything was backfilled into (010_organizations.sql).
// Calls without a resolvable active org fall back to it, so behavior is
// unchanged until a second org exists.
export const DEFAULT_ORG_SLUG = "zedu-egret";

export async function defaultOrgId(svc = serviceClient()): Promise<string> {
  const { data } = await svc.from("organizations").select("id").eq("slug", DEFAULT_ORG_SLUG).maybeSingle();
  if (!data) throw new Error("No organizations found — run 010_organizations.sql");
  return data.id;
}

// The caller's working org: users.active_org_id when set, else the default org.
// Unauthenticated callers (public catalog reads) land on the default org too.
export async function activeOrgId(userId?: string | null, svc = serviceClient()): Promise<string> {
  if (userId) {
    const { data } = await svc.from("users").select("active_org_id").eq("id", userId).maybeSingle();
    if (data?.active_org_id) return data.active_org_id;
  }
  return defaultOrgId(svc);
}
