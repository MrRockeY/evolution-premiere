import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import evolutionLogo from "@/assets/evolution-logo.png";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/os/ui";
import { useAuth } from "@/hooks/useAuth";
import { errMsg } from "@/lib/db";
import {
  checkDatabaseReady,
  isSupabaseConfigured,
  supabase,
  supabaseSqlEditorUrl,
} from "@/lib/supabase";

export const Route = createFileRoute("/owner/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Owner Desk Login | Evolution Fitness Patna" },
      {
        name: "description",
        content: "Private gym owner login for Evolution Fitness — manage members, fees, dues and attendance.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OwnerLoginPage,
});

function OwnerLoginPage() {
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [dbMessage, setDbMessage] = useState<string | null>(null);
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (user && role === "owner") {
      void navigate({ to: "/owner/desk", replace: true });
    }
  }, [loading, user, role, navigate]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setDbMessage("Add Supabase keys to .env, then restart the server.");
      return;
    }
    void checkDatabaseReady().then((r) => {
      setDbMessage(r.ready ? null : (r.message ?? "Database is not ready."));
    });
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isSupabaseConfigured || dbMessage) {
      toast.error(dbMessage || "Database is not connected.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const uid = data.user?.id;
      if (!uid) throw new Error("Sign in failed.");

      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      const isOwner = ((roles ?? []) as { role: string }[]).some((r) => r.role === "owner");
      if (!isOwner) {
        await supabase.auth.signOut();
        toast.error("This account is not a gym owner. Use Member login instead.");
        return;
      }
      toast.success("Welcome to the owner desk.");
      void navigate({ to: "/owner/desk", replace: true });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  if (!loading && user && role === "owner") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Opening owner desk…
      </div>
    );
  }

  return (
    <main className="grid min-h-screen bg-background text-foreground lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden flex-col justify-between border-r border-border bg-card p-12 lg:flex">
        <Link to="/" className="flex items-center gap-3">
          <img src={evolutionLogo} alt="" aria-hidden className="size-11 object-contain" />
          <span className="font-display text-xl font-black uppercase">
            Evolution <span className="text-primary">Desk</span>
          </span>
        </Link>
        <div>
          <h1 className="font-display text-6xl font-black uppercase leading-[0.85] sm:text-7xl">
            Owner
            <br />
            <span className="metallic-text">control.</span>
          </h1>
          <p className="mt-6 max-w-sm text-sm leading-6 text-muted-foreground">
            Manage every member, due date, fee, payment history and attendance from one private desk.
          </p>
          <ul className="mt-8 space-y-2 text-sm text-muted-foreground">
            <li>· Dues & renewals at a glance</li>
            <li>· Fees by month, method and plan</li>
            <li>· Assign membership + workout/diet</li>
            <li>· Desk check-in without member phones</li>
          </ul>
        </div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Staff only · Evolution Fitness Patna City
        </p>
      </section>

      <section className="flex flex-col justify-center px-5 py-14 sm:px-12">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-4" /> Back to website
        </Link>
        <h2 className="font-display text-5xl font-black uppercase leading-none">Owner sign in</h2>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">
          Gym owner access only. Members should use the member login.
        </p>

        {dbMessage && (
          <div className="mt-6 max-w-md border-l-2 border-primary bg-primary/5 p-4 text-xs leading-5 text-muted-foreground">
            <p>{dbMessage}</p>
            {isSupabaseConfigured && (
              <a
                href={supabaseSqlEditorUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block font-bold uppercase tracking-[0.16em] text-primary hover:underline"
              >
                Open SQL Editor →
              </a>
            )}
          </div>
        )}

        {user && role !== "owner" && (
          <div className="mt-6 max-w-md border-l-2 border-primary bg-primary/5 p-4 text-xs leading-5 text-muted-foreground">
            <p>You are signed in as a member. Sign out to use the owner desk, or open the member area.</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button variant="copperOutline" size="sm" onClick={async () => signOut()}>
                Sign out
              </Button>
              <Button asChild variant="copper" size="sm">
                <Link to="/dashboard">Member area</Link>
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={submit} className="mt-8 max-w-md space-y-4">
          <label className="block text-[10px] font-bold uppercase tracking-[0.18em]">
            Owner email
            <input name="email" type="email" required className={inputClass + " mt-2"} placeholder="owner@email.com" />
          </label>
          <label className="block text-[10px] font-bold uppercase tracking-[0.18em]">
            Password
            <div className="relative mt-2">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                className={inputClass + " pr-12"}
                placeholder="Your password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </label>
          <Button type="submit" variant="copper" size="editorial" className="w-full" disabled={busy || !!dbMessage}>
            {busy ? "Signing in…" : "Enter owner desk"}
          </Button>
        </form>

        <Link
          to="/auth"
          className="mt-6 w-fit text-xs font-bold uppercase tracking-[0.18em] text-primary hover:underline"
        >
          Member login →
        </Link>
      </section>
    </main>
  );
}
