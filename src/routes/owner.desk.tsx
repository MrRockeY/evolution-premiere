import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";

import evolutionLogo from "@/assets/evolution-logo.png";
import OwnerDashboard from "@/components/os/owner-dashboard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  checkDatabaseReady,
  isSupabaseConfigured,
  supabaseSqlEditorUrl,
} from "@/lib/supabase";

export const Route = createFileRoute("/owner/desk")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Owner Desk | Evolution Fitness Patna" },
      {
        name: "description",
        content: "Gym owner desk — members, dues, fees, payment history, plans and attendance.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OwnerDeskPage,
});

function OwnerDeskPage() {
  const { loading, user, role, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [dbReady, setDbReady] = useState<boolean | null>(null);
  const [dbMessage, setDbMessage] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: "/owner", replace: true });
      return;
    }
    if (role && role !== "owner") {
      void navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, user, role, navigate]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setDbReady(false);
      setDbMessage("Add your project URL and publishable key to .env, then restart the dev server.");
      return;
    }
    void checkDatabaseReady().then((r) => {
      setDbReady(r.ready);
      setDbMessage(r.ready ? null : (r.message ?? null));
    });
  }, []);

  if (!isSupabaseConfigured || dbReady === false) {
    return (
      <Centered>
        <h1 className="font-display text-4xl font-black uppercase">
          {!isSupabaseConfigured ? "Database not connected" : "Database setup needed"}
        </h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">{dbMessage}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {isSupabaseConfigured && (
            <Button asChild variant="copper" size="editorial">
              <a href={supabaseSqlEditorUrl} target="_blank" rel="noreferrer">
                Open SQL Editor
              </a>
            </Button>
          )}
          <Button asChild variant="copperOutline" size="editorial">
            <Link to="/">Back to website</Link>
          </Button>
        </div>
      </Centered>
    );
  }

  if (dbReady === null || loading) return <Centered>Loading owner desk…</Centered>;
  if (!user) return <Centered>Redirecting to owner login…</Centered>;
  if (role !== "owner") return <Centered>Owner access only…</Centered>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-4 px-5 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <img src={evolutionLogo} alt="" aria-hidden className="size-9 object-contain" />
            <span className="font-display text-lg font-black uppercase leading-none">
              Evolution <span className="text-primary">Desk</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight">{profile?.full_name || user.email}</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-primary">Gym owner</p>
            </div>
            <Button
              variant="copperOutline"
              size="sm"
              onClick={async () => {
                await signOut();
                void navigate({ to: "/owner", replace: true });
              }}
            >
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] px-5 py-8 lg:px-8 lg:py-10">
        <OwnerDashboard />
      </main>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5 text-center text-foreground">
      {children}
    </div>
  );
}
