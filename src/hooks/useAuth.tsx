import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Profile, Role } from "@/lib/domain";

type AuthState = {
  loading: boolean;
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: Role | null;
  configured: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  const user = session?.user ?? null;

  const load = async (uid: string, meta?: User["user_metadata"]) => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);

    let nextProfile = (p as Profile) ?? null;
    if (!nextProfile) {
      const fullName = typeof meta?.["full_name"] === "string" ? meta["full_name"] : null;
      const phone = typeof meta?.["phone"] === "string" ? meta["phone"] : null;
      const { data: upserted } = await supabase
        .from("profiles")
        .upsert({ id: uid, full_name: fullName, phone })
        .select("*")
        .maybeSingle();
      nextProfile = (upserted as Profile) ?? null;
      await supabase.from("user_roles").upsert({ user_id: uid, role: "customer" }, { onConflict: "user_id,role" });
    }

    setProfile(nextProfile);
    const roles = ((r ?? []) as { role: Role }[]).map((x) => x.role);
    setRole(roles.includes("owner") ? "owner" : "customer");
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) {
        load(data.session.user.id, data.session.user.user_metadata).finally(
          () => active && setLoading(false),
        );
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      setSession(next);
      if (event === "SIGNED_OUT" || !next?.user) {
        setProfile(null);
        setRole(null);
        setLoading(false);
        return;
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED") {
        setLoading(true);
        void load(next.user.id, next.user.user_metadata).finally(() => active && setLoading(false));
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      user,
      session,
      profile,
      role,
      configured: isSupabaseConfigured,
      refreshProfile: async () => {
        if (user) await load(user.id, user.user_metadata);
      },
      signOut: async () => {
        await supabase.auth.signOut();
        setProfile(null);
        setRole(null);
        setSession(null);
      },
    }),
    [loading, user, session, profile, role],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
