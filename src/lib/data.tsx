"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export type Row = Record<string, unknown>;

export function errText(e: unknown): string {
  const m = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : String(e);
  // database errors are raised as CODE:message, show only the human part
  return m.replace(/^[A-Z_]+:/, "").trim() || "Something went wrong";
}

/** Runs an async loader whenever `deps` change (or reload() is called) and exposes {data, error, loading, reload}. */
export function useLoad<T>(loader: () => Promise<T>, deps: readonly unknown[]) {
  const [tick, setTick] = useState(0);
  const key = `${JSON.stringify(deps)}:${tick}`;
  const [state, setState] = useState<{ key: string; data: T | null; error: string | null }>({ key: "", data: null, error: null });
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });
  useEffect(() => {
    let off = false;
    loaderRef
      .current()
      .then((d) => { if (!off) setState({ key, data: d, error: null }); })
      .catch((e) => { if (!off) setState((s) => ({ key, data: s.data, error: errText(e) })); });
    return () => { off = true; };
  }, [key]);
  const reload = useCallback(async () => { setTick((t) => t + 1); }, []);
  return { data: state.data, error: state.error, loading: state.key !== key, reload };
}

export function useDb() {
  return useMemo(() => supabaseBrowser(), []);
}

/** Calls a database function as the signed-in staff member and throws on error. */
export async function rpc<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabaseBrowser().rpc(name, args);
  if (error) throw error;
  return data as T;
}

export type Perms = { isOwner: boolean; has: (code: string) => boolean; list: string[] };

/** my_permissions() returns every permission code the caller currently holds (the owner holds them all). */
export async function loadPerms(): Promise<Perms> {
  const { data, error } = await supabaseBrowser().rpc("my_permissions");
  if (error) throw error;
  const list = ((data as string[] | null) ?? []).map(String);
  const set = new Set(list);
  return { isOwner: set.has("staff.manage") && set.has("settings.manage") && set.has("refunds.issue"), list, has: (c) => set.has(c) };
}
