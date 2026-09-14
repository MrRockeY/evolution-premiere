import { createClient } from "@supabase/supabase-js";

const url = (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) ?? "";
const anonKey = (import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined) ?? "";

/** True once real Supabase credentials have been placed in the .env file. */
export const isSupabaseConfigured =
  /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url) && anonKey.length > 30;

export const supabase = createClient(
  isSupabaseConfigured ? url : "https://placeholder.supabase.co",
  isSupabaseConfigured ? anonKey : "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "evolution-os-auth",
    },
  },
);
