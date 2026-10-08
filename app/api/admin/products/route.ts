import { NextResponse } from "next/server";
import { authUser, isAdminUser, serviceClient } from "@/lib/api-auth";
import { sanitizeText, submissionSchemaError } from "@/lib/validation";

// `is_active` = catalog visibility; `is_open` = purchasable gate enforced
// by checkout (423 when closed). Both toggled from the admin console.

type SchemaDef = {
  key: string;
  label: string;
  hint?: string;
  type: string;
  required?: boolean;
};

function cleanSchema(raw: unknown): SchemaDef[] {
  return (raw as SchemaDef[]).map((f) => {
    const out: SchemaDef = {
      key: String(f.key).trim(),
      label: sanitizeText(String(f.label), 120),
      type: String(f.type),
    };
    if (typeof f.hint === "string" && f.hint.trim()) out.hint = sanitizeText(f.hint, 200);
    if (f.required === true) out.required = true;
    return out;
  });
}

function fieldErrors(body: Record<string, unknown>, { creating }: { creating: boolean }): string | null {
  if (creating || body.title !== undefined) {
    const title = sanitizeText(String(body.title ?? ""), 255);
    if (title.length < 3) return "Title must be at least 3 characters";
  }
  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) return "Price must be a number ≥ 0";
  }
  for (const key of ["stage_number", "week_number"] as const) {
    if (body[key] !== undefined) {
      const n = Number(body[key]);
      if (!Number.isInteger(n) || n < 1 || n > 99) return `${key} must be an integer between 1 and 99`;
    }
  }
  if (body.is_active !== undefined && typeof body.is_active !== "boolean")
    return "is_active must be true or false";
  if (body.is_open !== undefined && typeof body.is_open !== "boolean")
    return "is_open must be true or false";
  if (body.submission_schema !== undefined) {
    const err = submissionSchemaError(body.submission_schema);
    if (err) return err;
  }
  return null;
}

async function guard(request: Request) {
  const user = await authUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await isAdminUser(user.id)))
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  return null;
}

// POST /api/admin/products — create a task product.
export async function POST(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    if (body?.stage_number === undefined) return NextResponse.json({ error: "stage_number is required" }, { status: 400 });
    const err = fieldErrors(body, { creating: true });
    if (err) return NextResponse.json({ error: err }, { status: 422 });

    const svc = serviceClient();
    const { data, error } = await svc
      .from("products")
      .insert({
        title: sanitizeText(String(body.title), 255),
        description: body.description != null ? sanitizeText(String(body.description), 2000) : null,
        price: body.price != null ? Number(body.price) : 0,
        stage_number: Number(body.stage_number),
        week_number: body.week_number != null ? Number(body.week_number) : 1,
        is_active: body.is_active !== false,
        is_open: body.is_open === true,
        submission_schema: cleanSchema(body.submission_schema ?? []),
      })
      .select("*")
      .single();
    if (error) {
      if (String(error.message).includes("duplicate"))
        return NextResponse.json({ error: `Task ${Number(body.stage_number)} already exists` }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ ok: true, product: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "product create failed" }, { status: 500 });
  }
}

// PATCH /api/admin/products — update an existing product by id. Partial:
// only the fields present in the body are changed.
export async function PATCH(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const id = String(body?.id || "");
    if (!id) return NextResponse.json({ error: "Product id is required" }, { status: 400 });
    const err = fieldErrors(body, { creating: false });
    if (err) return NextResponse.json({ error: err }, { status: 422 });

    const patch: Record<string, unknown> = {};
    if (body.title !== undefined) patch.title = sanitizeText(String(body.title), 255);
    if (body.description !== undefined)
      patch.description = body.description === null ? null : sanitizeText(String(body.description), 2000);
    if (body.price !== undefined) patch.price = Number(body.price);
    if (body.stage_number !== undefined) patch.stage_number = Number(body.stage_number);
    if (body.week_number !== undefined) patch.week_number = Number(body.week_number);
    if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active);
    if (body.is_open !== undefined) patch.is_open = Boolean(body.is_open);
    if (body.submission_schema !== undefined) patch.submission_schema = cleanSchema(body.submission_schema);
    if (Object.keys(patch).length === 0)
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

    const svc = serviceClient();
    const { data, error } = await svc.from("products").update(patch).eq("id", id).select("*").maybeSingle();
    if (error) {
      if (String(error.message).includes("duplicate"))
        return NextResponse.json({ error: `Task ${Number(body.stage_number)} already exists` }, { status: 409 });
      throw error;
    }
    if (!data) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    return NextResponse.json({ ok: true, product: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "product update failed" }, { status: 500 });
  }
}
