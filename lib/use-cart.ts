"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "./supabase-client";

// Shared product shape (mirrors app/page.tsx + cart-drawer.tsx CartProduct).
export type CartProduct = {
  id: string;
  title: string;
  stage_number: number;
  submission_schema?: Array<{
    key: string;
    label: string;
    hint?: string;
    type: "live_url" | "github_repo" | "drive_url" | "github_pr" | "text";
    required?: boolean;
  }>;
};

type CartValues = Record<string, string>;

// Merge a DB row into a values map. Prefers the values JSONB column; falls
// back to the legacy todo_url/repo_url columns for pre-004 rows.
function normalizeValues(row: {
  values?: unknown;
  todo_url?: unknown;
  repo_url?: unknown;
}): CartValues {
  const out: CartValues = {};
  if (row.values && typeof row.values === "object" && !Array.isArray(row.values)) {
    for (const [k, v] of Object.entries(row.values as Record<string, unknown>)) {
      out[String(k)] = String(v ?? "");
    }
  }
  if (row.todo_url && !out.deployed_url) out.deployed_url = String(row.todo_url);
  if (row.repo_url && !out.github_repo) out.github_repo = String(row.repo_url);
  return out;
}

// Legacy mirror for Task 1-shaped schemas (pre-004 rows have no values map).
// Prefers modern key names, falls back to the pre-004 field names.
function legacyMirror(values: CartValues): { todo_url: string | undefined; repo_url: string | undefined } {
  return {
    todo_url: values.deployed_url ?? values.todoAppUrl ?? undefined,
    repo_url: values.github_repo ?? values.mobile_repo ?? values.taskRepoUrl ?? undefined,
  };
}

type CartRow = {
  user_id: string;
  product_id: string;
  todo_url: string;
  repo_url: string;
  values: CartValues;
  updated_at: string;
};

// Cross-device cart: one persisted row per user in public.carts, synced both
// ways (web <-> mobile) over Supabase Realtime postgres_changes.
// Conflict rule: last-write-wins on updated_at (single-item cart, no merge).
export function useCart() {
  const [userId, setUserId] = useState("");
  const [cart, setCart] = useState<CartProduct | null>(null);
  // Schema-driven values map (keys come from the product's submission_schema).
  // Legacy todoUrl/repoUrl are derived for Task 1-shaped schemas.
  const [values, setValuesState] = useState<CartValues>({});
  const [loaded, setLoaded] = useState(false);
  const updatedAtRef = useRef("");
  const applyingRemote = useRef(false);
  const dirtyRef = useRef(false); // local change not yet persisted (write failed / offline)
  const removePendingRef = useRef(false); // local delete not yet persisted

  // Bootstrap: session + existing cart row.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = supabaseBrowser();
      const { data } = await sb.auth.getUser();
      const uid = data.user?.id || "";
      if (cancelled) return;
      setUserId(uid);
      if (!uid) {
        setLoaded(true);
        return;
      }
      const { data: row } = await sb
        .from("carts")
        .select("product_id, todo_url, repo_url, values, updated_at")
        .eq("user_id", uid)
        .maybeSingle();
      if (cancelled) return;
      if (row) {
        const { data: prod } = await sb
          .from("products")
          .select("id, title, stage_number, week_number, submission_schema")
          .eq("id", row.product_id)
          .maybeSingle();
        if (cancelled) return;
        if (prod) {
          setCart(prod as CartProduct);
          setValuesState(normalizeValues(row));
          updatedAtRef.current = row.updated_at || "";
        }
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  // Realtime subscription: remote changes (e.g. from the mobile app) apply
  // directly to local state, including row deletion (other side checked out).
  useEffect(() => {
    if (!userId) return;
    const sb = supabaseBrowser();
    const channel = sb
      .channel(`cart:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "carts",
          filter: `user_id=eq.${userId}`,
        },
        async (payload: any) => {
          if (payload.eventType === "DELETE") {
            applyingRemote.current = true;
            setCart(null);
            setValuesState({});
            updatedAtRef.current = "";
            applyingRemote.current = false;
            return;
          }
          const row = (payload.new || {}) as CartRow;
          if (!row.product_id || !row.updated_at) return;
          // Ignore our own echo when it is not newer.
          if (row.updated_at <= updatedAtRef.current) return;
          const { data: prod } = await sb
            .from("products")
            .select("id, title, stage_number, week_number, submission_schema")
            .eq("id", row.product_id)
            .maybeSingle();
          if (!prod) return;
          applyingRemote.current = true;
          setCart(prod as CartProduct);
          setValuesState(normalizeValues(row));
          updatedAtRef.current = row.updated_at;
          applyingRemote.current = false;
        }
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [userId]);

  // Heartbeat for devices that resumed from sleep: re-read the row so a cart
  // changed while this tab slept is picked up even if the socket dropped.
  // Also backfills: if the user opened a cart before their session resolved
  // (openCart skipped the remote write), write their local cart now so the
  // other device sees it.
  const refresh = useCallback(async () => {
    if (!userId) return;
    const sb = supabaseBrowser();
    const { data: row } = await sb
      .from("carts")
      .select("product_id, todo_url, repo_url, values, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) {
      if (cart) {
        const stamp = new Date().toISOString();
        const legacy = legacyMirror(values);
        const { error } = await sb.from("carts").upsert(
          {
            user_id: userId,
            product_id: cart.id,
            todo_url: legacy.todo_url ?? "",
            repo_url: legacy.repo_url ?? "",
            values,
            updated_at: stamp,
          },
          { onConflict: "user_id" }
        );
        if (!error) {
          dirtyRef.current = false;
          updatedAtRef.current = stamp;
        }
      } else {
        applyingRemote.current = true;
        setCart(null);
        setValuesState({});
        updatedAtRef.current = "";
        applyingRemote.current = false;
      }
      return;
    }
    if (row.updated_at && row.updated_at <= updatedAtRef.current) return;
    const { data: prod } = await sb
      .from("products")
      .select("id, title, stage_number, week_number, submission_schema")
      .eq("id", row.product_id)
      .maybeSingle();
    if (!prod) return;
    applyingRemote.current = true;
    setCart(prod as CartProduct);
    setValuesState(normalizeValues(row));
    updatedAtRef.current = row.updated_at;
    applyingRemote.current = false;
  }, [userId, cart, values]);

  useEffect(() => {
    if (!userId) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [userId, refresh]);

  const writeRow = useCallback(
    async (patch: Partial<CartValues>) => {
      if (!userId || !cart?.id) return;
      const merged: CartValues = {};
      for (const [k, v] of Object.entries({ ...values, ...patch })) {
        merged[k] = String(v ?? "");
      }
      const legacy = legacyMirror(merged);
      const stamp = new Date().toISOString();
      const sb = supabaseBrowser();
      const { error } = await sb.from("carts").upsert(
        {
          user_id: userId,
          product_id: cart.id,
          todo_url: legacy.todo_url ?? "",
          repo_url: legacy.repo_url ?? "",
          values: merged,
          updated_at: stamp,
        },
        { onConflict: "user_id" }
      );
      if (!error) {
        dirtyRef.current = false;
        updatedAtRef.current = stamp;
      } else {
        dirtyRef.current = true;
        console.error("[use-cart:write-failed]", error.message);
      }
    },
    [userId, cart, values]
  );

  // Debounced remote write for URL typing (local state updates instantly).
  const urlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueValuesWrite = useCallback(
    (patch: Partial<CartValues>) => {
      if (urlTimer.current) clearTimeout(urlTimer.current);
      urlTimer.current = setTimeout(() => void writeRow(patch), 600);
    },
    [writeRow]
  );

  useEffect(
    () => () => {
      if (urlTimer.current) clearTimeout(urlTimer.current);
    },
    []
  );

  const openCart = useCallback(
    async (product: CartProduct) => {
      // Update local state FIRST so the drawer opens instantly even if the
      // session/bootstrap is still resolving or the network is slow. The
      // remote write below is best-effort sync, not a gate.
      setCart(product);
      setValuesState({});
      if (!userId) {
        dirtyRef.current = true;
        return;
      }
      const stamp = new Date().toISOString();
      const { error } = await supabaseBrowser()
        .from("carts")
        .upsert(
          {
            user_id: userId,
            product_id: product.id,
            todo_url: "",
            repo_url: "",
            values: {},
            updated_at: stamp,
          },
          { onConflict: "user_id" }
        );
      if (!error) {
        dirtyRef.current = false;
        updatedAtRef.current = stamp;
      } else {
        dirtyRef.current = true;
        console.error("[use-cart:openCart-failed]", error.message);
      }
    },
    [userId]
  );

  const removeCart = useCallback(async () => {
    setCart(null);
    setValuesState({});
    updatedAtRef.current = "";
    if (!userId) {
      removePendingRef.current = true;
      return;
    }
    const { error } = await supabaseBrowser()
      .from("carts")
      .delete()
      .eq("user_id", userId);
    if (error) {
      removePendingRef.current = true;
      console.error("[use-cart:remove-failed]", error.message);
    } else {
      removePendingRef.current = false;
    }
  }, [userId]);

  const setValues = useCallback(
    (v: CartValues) => {
      setValuesState(v);
      // Queue only the diff so typing one field doesn't rewrite everything.
      if (!applyingRemote.current) queueValuesWrite(v);
    },
    [queueValuesWrite]
  );

  // Reconnect / late-session sync. When the browser comes back online (or the
  // session resolves after the user already opened a cart), push unsent local
  // changes first; otherwise pull the server row. This is what makes offline
  // edits converge to other devices instead of being lost.
  const syncOnReconnect = useCallback(() => {
    if (removePendingRef.current) {
      void (async () => {
        const { error } = await supabaseBrowser()
          .from("carts")
          .delete()
          .eq("user_id", userId);
        if (!error) removePendingRef.current = false;
        else console.error("[use-cart:remove-retry-failed]", error.message);
      })();
    } else if (dirtyRef.current && cart) {
      void writeRow({});
    } else {
      void refresh();
    }
  }, [userId, cart, writeRow, refresh]);

  useEffect(() => {
    if (!userId || !loaded) return;
    if (dirtyRef.current || removePendingRef.current) syncOnReconnect();
    window.addEventListener("online", syncOnReconnect);
    return () => window.removeEventListener("online", syncOnReconnect);
  }, [userId, loaded, syncOnReconnect]);

  return {
    userId,
    cart,
    values,
    todoUrl: String(values.deployed_url || values.todoAppUrl || ""),
    repoUrl: String(values.github_repo || values.mobile_repo || values.taskRepoUrl || ""),
    loaded,
    openCart,
    removeCart,
    setValues,
    setTodoUrl: (v: string) => setValues({ ...values, deployed_url: v }),
    setRepoUrl: (v: string) => setValues({ ...values, github_repo: v }),
    refresh,
  };
}


