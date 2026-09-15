import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

type Result<T> = { data: T | null; error: { message: string } | null };

/** Small async data hook for client-side Supabase reads. */
export function useAsyncData<T>(loader: () => PromiseLike<Result<T>>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    const res = await loader();
    setError(res.error?.message ?? null);
    setData((res.data ?? null) as T | null);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void run();
  }, [run]);

  return { data, loading, error, reload: run };
}

export const db = supabase;

export function addMonths(dateISO: string, months: number) {
  const d = new Date(dateISO);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export const today = () => new Date().toISOString().slice(0, 10);

export function errMsg(e: unknown) {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Something went wrong. Please try again.";
}
