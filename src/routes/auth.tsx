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

type Mode = "signin" | "signup" | "reset";

function AuthPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [dbMessage, setDbMessage] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/dashboard", replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setDbMessage(
        "Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env, then restart the dev server.",
      );
      return;
    }
    void checkDatabaseReady().then((r) => {
      setDbMessage(r.ready ? null : (r.message ?? "Database is not ready."));
    });
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isSupabaseConfigured) {
      toast.error("Add your database keys in the .env file to enable accounts.");
      return;
    }
    if (dbMessage) {
      toast.error(dbMessage);
      return;
    }
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setBusy(true);
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/auth",
        });
        if (error) throw error;
        toast.success("Password reset email sent. Check your inbox.");
        setMode("signin");
        return;
      }

      if (mode === "signup") {
        const confirm = String(form.get("confirm_password") ?? "");
        if (password !== confirm) {
          toast.error("Passwords do not match.");
          return;
        }
        const phone = String(form.get("phone") ?? "").trim();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/dashboard",
            data: {
              full_name: String(form.get("full_name") ?? "").trim(),
              phone,
            },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setPendingConfirm(email);
          toast.success("Account created. Confirm your email, then sign in.");
          setMode("signin");
        } else {
          toast.success("Welcome to Evolution OS.");
          void navigate({ to: "/dashboard", replace: true });
        }
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Signed in.");
      void navigate({ to: "/dashboard", replace: true });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const resendConfirm = async () => {
    if (!pendingConfirm) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: pendingConfirm,
        options: { emailRedirectTo: window.location.origin + "/dashboard" },
      });
      if (error) throw error;
      toast.success("Confirmation email resent.");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const title =
    mode === "signin" ? "Member sign in" : mode === "signup" ? "Create account" : "Reset password";
  const subtitle =
    mode === "signin"
      ? "Members sign in here. Gym staff use the owner desk login."
      : mode === "signup"
        ? "Create your member account. The desk assigns your membership after signup."
        : "Enter your email and we will send a reset link.";

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
            Membership, workout plan, diet, attendance and progress — your private Evolution Fitness
            member area.
          </p>
          <ul className="mt-8 space-y-2 text-sm text-muted-foreground">
            <li>· Daily floor check-in</li>
            <li>· Gym-assigned workout & diet</li>
            <li>· Ask the trainer anytime</li>
          </ul>
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
        <h2 className="font-display text-5xl font-black uppercase leading-none">{title}</h2>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">{subtitle}</p>

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

        {pendingConfirm && mode === "signin" && (
          <div className="mt-6 max-w-md border-l-2 border-primary bg-primary/5 p-4 text-xs leading-5 text-muted-foreground">
            <p>
              Waiting for email confirmation for <span className="text-foreground">{pendingConfirm}</span>.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void resendConfirm()}
              className="mt-3 font-bold uppercase tracking-[0.16em] text-primary hover:underline"
            >
              Resend confirmation email
            </button>
          </div>
        )}

        <form onSubmit={submit} className="mt-8 max-w-md space-y-4">
          {mode === "signup" && (
            <>
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em]">
                Full name
                <input name="full_name" required className={inputClass + " mt-2"} placeholder="Your name" />
              </label>
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em]">
                Phone (for desk / WhatsApp)
                <input
                  name="phone"
                  type="tel"
                  required
                  className={inputClass + " mt-2"}
                  placeholder="10-digit mobile"
                />
              </label>
            </>
          )}
          <label className="block text-[10px] font-bold uppercase tracking-[0.18em]">
            Email
            <input name="email" type="email" required className={inputClass + " mt-2"} placeholder="you@email.com" />
          </label>
          {mode !== "reset" && (
            <label className="block text-[10px] font-bold uppercase tracking-[0.18em]">
              Password
              <div className="relative mt-2">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  className={inputClass + " pr-12"}
                  placeholder="At least 6 characters"
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
          )}
          {mode === "signup" && (
            <label className="block text-[10px] font-bold uppercase tracking-[0.18em]">
              Confirm password
              <input
                name="confirm_password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                className={inputClass + " mt-2"}
                placeholder="Repeat password"
              />
            </label>
          )}
          <Button type="submit" variant="copper" size="editorial" className="w-full" disabled={busy || !!dbMessage}>
            {busy
              ? "Please wait…"
              : mode === "signin"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : "Send reset link"}
          </Button>
        </form>

        <div className="mt-6 flex flex-col gap-3">
          {mode === "signin" && (
            <button
              type="button"
              onClick={() => setMode("reset")}
              className="w-fit text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground hover:text-primary"
            >
              Forgot password?
            </button>
          )}
          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="w-fit text-xs font-bold uppercase tracking-[0.18em] text-primary hover:underline"
          >
            {mode === "signup" ? "Already a member? Sign in" : "New here? Create an account"}
          </button>
          {mode === "reset" && (
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="w-fit text-xs font-bold uppercase tracking-[0.18em] text-primary hover:underline"
            >
              Back to sign in
            </button>
          )}
          <Link
            to="/owner"
            className="w-fit text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground hover:text-primary"
          >
            Gym owner desk →
          </Link>
        </div>
      </section>
    </main>
  );
}
