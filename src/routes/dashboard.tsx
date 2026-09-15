import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useEffect } from "react";

import evolutionLogo from "@/assets/evolution-logo.png";
import CustomerDashboard from "@/components/os/customer-dashboard";
import OwnerDashboard from "@/components/os/owner-dashboard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Evolution OS Dashboard | Evolution Fitness Patna" },
      {
        name: "description",
        content:
          "Private Evolution OS dashboard for gym members and the owner: memberships, fees, workouts, diet plans, attendance and progress.",
      },
      { property: "og:title", content: "Evolution OS Dashboard" },
      { property: "og:description", content: "Private gym management and member area." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { loading, user, role, profile, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  if (!isSupabaseConfigured) {
    return (
      <Centered>
        <h1 className="font-display text-4xl font-black uppercase">Database not connected</h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
          Add your project URL and key to the .env file, then run the setup script in
          supabase/schema.sql. The dashboard activates automatically after that.
        </p>
        <Button asChild variant="copperOutline" size="editorial" className="mt-8">
          <Link to="/">Back to website</Link>
        </Button>
      </Centered>
    );
  }

  if (loading) return <Centered>Loading your dashboard…</Centered>;
  if (!user) return <Centered>Redirecting to sign in…</Centered>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-4 px-5 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <img src={evolutionLogo} alt="" aria-hidden className="size-9 object-contain" />
            <span className="font-display text-lg font-black uppercase leading-none">
              Evolution <span className="text-primary">OS</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight">
                {profile?.full_name || user.email}
              </p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-primary">
                {role === "owner" ? "Owner" : "Member"}
              </p>
            </div>
            <Button
              variant="copperOutline"
              size="sm"
              onClick={async () => {
                await signOut();
                void navigate({ to: "/auth", replace: true });
              }}
            >
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] px-5 py-8 lg:px-8 lg:py-10">
        {role === "owner" ? <OwnerDashboard /> : <CustomerDashboard />}
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
