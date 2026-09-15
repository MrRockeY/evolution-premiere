import { createClient } from "@supabase/supabase-js";

const url = (import.meta.env["VITE_SUPABASE_URL"] as string | undefined)?.trim() ?? "";
const anonKey =
  (
    (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined) ||
    (import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined) ||
    ""
  ).trim();

/** True once real Supabase credentials have been placed in the .env file. */
export const isSupabaseConfigured =
  /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url) && anonKey.length > 20;

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

/** Project ref derived from the configured URL (for dashboard deep-links). */
export const supabaseProjectRef = url.match(
  /^https:\/\/([a-z0-9-]+)\.supabase\.(co|in)$/i,
)?.[1];

export const supabaseSqlEditorUrl = supabaseProjectRef
  ? `https://supabase.com/dashboard/project/${supabaseProjectRef}/sql/new`
  : "https://supabase.com/dashboard";

/** Quick probe: keys work but schema.sql may not have been applied yet. */
export async function checkDatabaseReady(): Promise<{
  ready: boolean;
  message?: string;
}> {
  if (!isSupabaseConfigured) {
    return { ready: false, message: "Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env." };
  }
  const { error } = await supabase.from("profiles").select("id").limit(1);
  if (!error) return { ready: true };
  if (error.code === "PGRST205" || /Could not find the table/i.test(error.message)) {
    return {
      ready: false,
      message:
        "Database keys work, but tables are missing. Run supabase/schema.sql once in the Supabase SQL Editor.",
    };
  }
  return { ready: false, message: error.message };
}
