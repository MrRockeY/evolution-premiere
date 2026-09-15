import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import evolutionLogo from "@/assets/evolution-logo.png";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/os/ui";
import { useAuth } from "@/hooks/useAuth";
import { errMsg } from "@/lib/db";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Member Login | Evolution OS — Evolution Fitness Patna" },
      {
        name: "description",
        content:
          "Sign in or create your Evolution Fitness member account to access workouts, diet plans, membership and progress tracking.",
      },
      { property: "og:title", content: "Evolution OS — Member Login" },
      {
        property: "og:description",
        content: "Secure member and owner access to the Evolution Fitness gym platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/dashboard", replace: true });
  }, [loading, user, navigate]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isSupabaseConfigured) {
      toast.error("Add your database keys in the .env file to enable accounts.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/dashboard",
            data: {
              full_name: String(form.get("full_name") ?? ""),
              phone: String(form.get("phone") ?? ""),
            },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Account created. Check your email to confirm, then sign in.");
          setMode("signin");
        } else {
          toast.success("Welcome to Evolution OS.");
          void navigate({ to: "/dashboard", replace: true });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in.");
        void navigate({ to: "/dashboard", replace: true });
      }
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-background text-foreground lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden flex-col justify-between border-r border-border bg-card p-12 lg:flex">
        <Link to="/" className="flex items-center gap-3">
          <img src={evolutionLogo} alt="" aria-hidden className="size-11 object-contain" />
          <span className="font-display text-xl font-black uppercase">
            Evolution <span className="text-primary">OS</span>
          </span>
        </Link>
        <div>
          <h1 className="font-display text-7xl font-black uppercase leading-[0.8]">
            Train.
            <br />
            Track.
            <br />
            <span className="metallic-text">Evolve.</span>
          </h1>
          <p className="mt-6 max-w-sm text-sm leading-6 text-muted-foreground">
            Your membership, workout plan, diet plan, attendance and progress — all in one private
            member area.
          </p>
        </div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Jauganj · Kanghan Ghat · Patna City
        </p>
      </section>

      <section className="flex flex-col justify-center px-5 py-14 sm:px-12">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-4" /> Back to website
        </Link>
        <h2 className="font-display text-5xl font-black uppercase leading-none">
          {mode === "signin" ? "Member sign in" : "Create account"}
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Owners and members sign in with the same form."
            : "New members start here. Your trainer access is set by the gym owner."}
        </p>

        {!isSupabaseConfigured && (
          <p className="mt-6 border-l-2 border-primary bg-primary/5 p-4 text-xs leading-5 text-muted-foreground">
            Accounts are inactive until the database keys are filled into the .env file and the
            setup script in supabase/schema.sql has been run.
          </p>
        )}

        <form onSubmit={submit} className="mt-8 max-w-md space-y-4">
          {mode === "signup" && (
            <>
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em]">
                Full name
                <input name="full_name" required className={inputClass + " mt-2"} placeholder="Your name" />
              </label>
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em]">
                Phone
                <input name="phone" type="tel" className={inputClass + " mt-2"} placeholder="Mobile number" />
              </label>
            </>
          )}
          <label className="block text-[10px] font-bold uppercase tracking-[0.18em]">
            Email
            <input name="email" type="email" required className={inputClass + " mt-2"} placeholder="you@email.com" />
          </label>
          <label className="block text-[10px] font-bold uppercase tracking-[0.18em]">
            Password
            <input
              name="password"
              type="password"
              required
              minLength={6}
              className={inputClass + " mt-2"}
              placeholder="At least 6 characters"
            />
          </label>
          <Button type="submit" variant="copper" size="editorial" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-6 w-fit text-xs font-bold uppercase tracking-[0.18em] text-primary hover:underline"
        >
          {mode === "signin" ? "New here? Create an account" : "Already a member? Sign in"}
        </button>
      </section>
    </main>
  );
}
