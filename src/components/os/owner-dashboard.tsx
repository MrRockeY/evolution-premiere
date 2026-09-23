import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Disclaimer, Empty, Field, Loading, Panel, Stat, TabBar, Table, inputClass } from "@/components/os/ui";
import { Button } from "@/components/ui/button";
import { addMonths, db, errMsg, today, useAsyncData } from "@/lib/db";
import {
  BILL_CATEGORIES,
  BILL_STATUSES,
  fmtDate,
  inr,
  labelOf,
  DIETS,
  GOALS,
  LEVELS,
  type AdviceRequest,
  type Attendance,
  type Bill,
  type DietTemplate,
  type Expense,
  type MemberPlan,
  type Membership,
  type MembershipPlan,
  type Payment,
  type Profile,
  type ProgressEntry,
  type WorkoutTemplate,
} from "@/lib/domain";
import { useAuth } from "@/hooks/useAuth";

const TABS = [
  { id: "desk", label: "Desk" },
  { id: "members", label: "Members" },
  { id: "dues", label: "Dues" },
  { id: "billing", label: "Billing" },
  { id: "fees", label: "Fees" },
  { id: "plans", label: "Plans" },
  { id: "expenses", label: "Expenses" },
  { id: "attendance", label: "Attendance" },
  { id: "templates", label: "Templates" },
  { id: "advice", label: "Advice" },
] as const;

type TabId = (typeof TABS)[number]["id"];

type OwnerData = {
  profiles: Profile[];
  plans: MembershipPlan[];
  memberships: Membership[];
  payments: Payment[];
  bills: Bill[];
  expenses: Expense[];
  attendance: Attendance[];
  workouts: WorkoutTemplate[];
  diets: DietTemplate[];
  memberPlans: MemberPlan[];
  requests: (AdviceRequest & { advice_replies: { id: string; message: string; created_at: string }[] })[];
  progress: ProgressEntry[];
};

export default function OwnerDashboard() {
  const [tab, setTab] = useState<TabId>("desk");
  const [focusMemberId, setFocusMemberId] = useState<string | null>(null);
  const { data, loading, error, reload } = useAsyncData<OwnerData>(async () => {
    const [
      profiles,
      plans,
      memberships,
      payments,
      bills,
      expenses,
      attendance,
      workouts,
      diets,
      memberPlans,
      requests,
      progress,
    ] = await Promise.all([
      db.from("profiles").select("*").order("created_at", { ascending: false }),
      db.from("membership_plans").select("*").order("months"),
      db.from("memberships").select("*").order("end_date", { ascending: false }),
      db.from("payments").select("*").order("paid_on", { ascending: false }),
      db.from("bills").select("*").order("created_at", { ascending: false }).limit(400),
      db.from("expenses").select("*").order("spent_on", { ascending: false }),
      db.from("attendance").select("*").order("attended_on", { ascending: false }).limit(300),
      db.from("workout_templates").select("*").order("created_at"),
      db.from("diet_templates").select("*").order("created_at"),
      db.from("member_plans").select("*").order("created_at", { ascending: false }),
      db
        .from("advice_requests")
        .select("*, advice_replies(id, message, created_at)")
        .order("created_at", { ascending: false }),
      db.from("progress_entries").select("*").order("entry_date", { ascending: false }).limit(300),
    ]);
    const firstError = [
      profiles,
      plans,
      memberships,
      payments,
      expenses,
      attendance,
      workouts,
      diets,
      memberPlans,
      requests,
      progress,
    ].find((r) => r.error);
    // bills table may not exist until supabase/bills.sql is run
    return {
      data: {
        profiles: (profiles.data ?? []) as Profile[],
        plans: (plans.data ?? []) as MembershipPlan[],
        memberships: (memberships.data ?? []) as Membership[],
        payments: (payments.data ?? []) as Payment[],
        bills: bills.error ? [] : ((bills.data ?? []) as Bill[]),
        expenses: (expenses.data ?? []) as Expense[],
        attendance: (attendance.data ?? []) as Attendance[],
        workouts: (workouts.data ?? []) as WorkoutTemplate[],
        diets: (diets.data ?? []) as DietTemplate[],
        memberPlans: (memberPlans.data ?? []) as MemberPlan[],
        requests: (requests.data ?? []) as OwnerData["requests"],
        progress: (progress.data ?? []) as ProgressEntry[],
      },
      error: firstError?.error ? { message: firstError.error.message } : null,
    };
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Loading />
        {error && <p className="text-center text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Owner desk</p>
        <h1 className="mt-2 font-display text-5xl font-black uppercase leading-none sm:text-6xl">
          Run the gym.
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Dues, fees, members and attendance — organised so desk work stays fast.
        </p>
      </div>
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab === "desk" && <DeskHub d={data} onGo={setTab} />}
      {tab === "dues" && (
        <DuesBoard
          d={data}
          reload={reload}
          onManage={(id) => {
            setFocusMemberId(id);
            setTab("members");
          }}
        />
      )}
      {tab === "members" && <Members d={data} reload={reload} initialOpenId={focusMemberId} />}
      {tab === "billing" && <Billing d={data} reload={reload} />}
      {tab === "plans" && <Plans d={data} reload={reload} />}
      {tab === "fees" && <Fees d={data} reload={reload} />}
      {tab === "expenses" && <Expenses d={data} reload={reload} />}
      {tab === "attendance" && <AttendanceTab d={data} reload={reload} />}
      {tab === "templates" && <Templates d={data} reload={reload} />}
      {tab === "advice" && <Advice d={data} reload={reload} />}
    </div>
  );
}

const name = (d: OwnerData, id: string) =>
  d.profiles.find((p) => p.id === id)?.full_name || "Member";

const activeMembershipFor = (d: OwnerData, userId: string) =>
  d.memberships.find((m) => m.user_id === userId && m.status === "active" && m.end_date >= today()) ??
  d.memberships.find((m) => m.user_id === userId);

const activeMemberPlanFor = (d: OwnerData, userId: string) =>
  d.memberPlans.find((p) => p.user_id === userId && p.active);

const daysUntil = (iso: string) => {
  const end = new Date(iso + "T00:00:00");
  const start = new Date(today() + "T00:00:00");
  return Math.ceil((end.getTime() - start.getTime()) / 86400000);
};

type MemberCategory = "active" | "due_soon" | "overdue" | "paused" | "none";

const categorizeMember = (d: OwnerData, userId: string): MemberCategory => {
  const m = activeMembershipFor(d, userId);
  if (!m) return "none";
  if (m.status === "paused") return "paused";
  if (m.status === "active" && m.end_date >= today()) {
    const left = daysUntil(m.end_date);
    return left <= 7 ? "due_soon" : "active";
  }
  return "overdue";
};

const CATEGORY_LABEL: Record<MemberCategory, string> = {
  active: "Active",
  due_soon: "Due in 7 days",
  overdue: "Expired / overdue",
  paused: "Paused",
  none: "No membership",
};

function DeskHub({ d, onGo }: { d: OwnerData; onGo: (id: TabId) => void }) {
  const revenue = d.payments.reduce((s, p) => s + Number(p.amount), 0);
  const spend = d.expenses.reduce((s, e) => s + Number(e.amount), 0);
  const todayCount = d.attendance.filter((a) => a.attended_on === today()).length;
  const openAdvice = d.requests.filter((r) => r.status === "open").length;

  const counts = useMemo(() => {
    const c: Record<MemberCategory, number> = { active: 0, due_soon: 0, overdue: 0, paused: 0, none: 0 };
    for (const p of d.profiles) c[categorizeMember(d, p.id)] += 1;
    return c;
  }, [d]);

  const dueSoon = d.profiles
    .filter((p) => categorizeMember(d, p.id) === "due_soon")
    .map((p) => ({ profile: p, m: activeMembershipFor(d, p.id)! }))
    .sort((a, b) => a.m.end_date.localeCompare(b.m.end_date));

  const overdue = d.profiles
    .filter((p) => categorizeMember(d, p.id) === "overdue")
    .map((p) => ({ profile: p, m: activeMembershipFor(d, p.id)! }))
    .sort((a, b) => a.m.end_date.localeCompare(b.m.end_date));

  const byMethod = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of d.payments) map.set(p.method, (map.get(p.method) ?? 0) + Number(p.amount));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [d.payments]);

  const thisMonthKey = today().slice(0, 7);
  const monthCollected = d.payments
    .filter((p) => p.paid_on.startsWith(thisMonthKey))
    .reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="This month" value={inr(monthCollected)} hint="Fees collected" />
        <Stat label="All-time net" value={inr(revenue - spend)} hint={`${inr(revenue)} in · ${inr(spend)} out`} />
        <Stat label="Active" value={String(counts.active)} hint="Current members" />
        <Stat label="Due soon" value={String(counts.due_soon)} hint="Renew within 7 days" />
        <Stat label="Floor today" value={String(todayCount)} hint={`${openAdvice} open advice`} />
      </div>

      <Panel title="Member categories">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(Object.keys(CATEGORY_LABEL) as MemberCategory[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onGo(key === "due_soon" || key === "overdue" ? "dues" : "members")}
              className="border border-border bg-background p-4 text-left transition-colors hover:border-primary"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">{CATEGORY_LABEL[key]}</p>
              <p className="mt-2 font-display text-3xl font-black">{counts[key]}</p>
            </button>
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Renewals due soon"
          action={
            <Button variant="ghost" size="sm" onClick={() => onGo("dues")}>
              Full dues board
            </Button>
          }
        >
          {dueSoon.length === 0 ? (
            <Empty text="No renewals in the next 7 days." />
          ) : (
            <Table head={["Member", "Plan", "Ends", "Days"]}>
              {dueSoon.slice(0, 8).map(({ profile, m }) => (
                <tr key={profile.id} className="border-b border-border/60">
                  <td className="py-3 pr-4 font-semibold">{profile.full_name || "—"}</td>
                  <td className="py-3 pr-4">{d.plans.find((p) => p.id === m.plan_id)?.name ?? "—"}</td>
                  <td className="py-3 pr-4">{fmtDate(m.end_date)}</td>
                  <td className="py-3 pr-4 text-primary">{daysUntil(m.end_date)}d</td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>

        <Panel title="Expired / overdue">
          {overdue.length === 0 ? (
            <Empty text="No overdue memberships." />
          ) : (
            <Table head={["Member", "Phone", "Ended", ""]}>
              {overdue.slice(0, 8).map(({ profile, m }) => (
                <tr key={profile.id} className="border-b border-border/60">
                  <td className="py-3 pr-4 font-semibold">{profile.full_name || "—"}</td>
                  <td className="py-3 pr-4">{profile.phone || "—"}</td>
                  <td className="py-3 pr-4">{fmtDate(m.end_date)}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{m.status}</td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Fees by payment method">
          {byMethod.length === 0 ? (
            <Empty text="No payments yet." />
          ) : (
            <Table head={["Method", "Total"]}>
              {byMethod.map(([method, total]) => (
                <tr key={method} className="border-b border-border/60">
                  <td className="py-3 pr-4 uppercase font-semibold">{method}</td>
                  <td className="py-3 pr-4">{inr(total)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
        <Panel title="Quick actions">
          <div className="flex flex-wrap gap-3">
            <Button variant="copper" size="editorial" onClick={() => onGo("members")}>
              Manage members
            </Button>
            <Button variant="copperOutline" size="editorial" onClick={() => onGo("billing")}>
              Create bill
            </Button>
            <Button variant="copperOutline" size="editorial" onClick={() => onGo("fees")}>
              Record fee
            </Button>
            <Button variant="copperOutline" size="editorial" onClick={() => onGo("attendance")}>
              Desk check-in
            </Button>
            <Button variant="copperOutline" size="editorial" onClick={() => onGo("advice")}>
              Advice ({openAdvice})
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function DuesBoard({
  d,
  reload,
  onManage,
}: {
  d: OwnerData;
  reload: () => void;
  onManage: (userId: string) => void;
}) {
  const [filter, setFilter] = useState<"all" | "due_soon" | "overdue">("all");

  const rows = d.profiles
    .map((p) => {
      const cat = categorizeMember(d, p.id);
      const m = activeMembershipFor(d, p.id);
      return { profile: p, cat, m };
    })
    .filter((r) => {
      if (filter === "all") return r.cat === "due_soon" || r.cat === "overdue";
      return r.cat === filter;
    })
    .sort((a, b) => (a.m?.end_date ?? "").localeCompare(b.m?.end_date ?? ""));

  const extend = async (m: Membership, months: number) => {
    const base = m.end_date >= today() ? m.end_date : today();
    const { error } = await db
      .from("memberships")
      .update({ end_date: addMonths(base, months), status: "active" })
      .eq("id", m.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Extended by ${months} month${months > 1 ? "s" : ""}.`);
      reload();
    }
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Dues & renewals"
        action={
          <div className="flex gap-2">
            {(
              [
                ["all", "All action"],
                ["due_soon", "Due soon"],
                ["overdue", "Overdue"],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                variant={filter === id ? "copper" : "copperOutline"}
                size="sm"
                onClick={() => setFilter(id)}
              >
                {label}
              </Button>
            ))}
          </div>
        }
      >
        {rows.length === 0 ? (
          <Empty text="Nothing needs attention in this filter." />
        ) : (
          <Table head={["Member", "Phone", "Plan", "Status", "Ends", ""]}>
            {rows.map(({ profile, cat, m }) => (
              <tr key={profile.id} className="border-b border-border/60 align-top">
                <td className="py-3 pr-4 font-semibold">{profile.full_name || "—"}</td>
                <td className="py-3 pr-4">{profile.phone || "—"}</td>
                <td className="py-3 pr-4">{m ? d.plans.find((p) => p.id === m.plan_id)?.name ?? "—" : "—"}</td>
                <td className="py-3 pr-4">
                  <span className={cat === "overdue" ? "text-destructive" : "text-primary"}>
                    {CATEGORY_LABEL[cat]}
                  </span>
                </td>
                <td className="py-3 pr-4">{m ? fmtDate(m.end_date) : "—"}</td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-2">
                    {m && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => void extend(m, 1)}>
                          +1 mo
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => void extend(m, 3)}>
                          +3 mo
                        </Button>
                      </>
                    )}
                    <Button variant="copperOutline" size="sm" onClick={() => onManage(profile.id)}>
                      Manage
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}

function Members({
  d,
  reload,
  initialOpenId,
}: {
  d: OwnerData;
  reload: () => void;
  initialOpenId?: string | null;
}) {
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (initialOpenId) setOpenId(initialOpenId);
  }, [initialOpenId]);

  const rows = d.profiles.filter(
    (p) =>
      (p.full_name ?? "").toLowerCase().includes(q.toLowerCase()) ||
      (p.phone ?? "").includes(q),
  );

  const assign = async (event: FormEvent<HTMLFormElement>, userId: string) => {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const planId = String(f.get("plan_id"));
    const plan = d.plans.find((p) => p.id === planId);
    if (!plan) return;
    const start = String(f.get("start_date") || today());
    try {
      await db
        .from("memberships")
        .update({ status: "expired" })
        .eq("user_id", userId)
        .eq("status", "active");

      const { data: created, error } = await db
        .from("memberships")
        .insert({
          user_id: userId,
          plan_id: plan.id,
          start_date: start,
          end_date: addMonths(start, plan.months),
          status: "active",
        })
        .select()
        .single();
      if (error) throw error;
      if (f.get("record_payment") === "on") {
        const { error: payErr } = await db.from("payments").insert({
          user_id: userId,
          membership_id: created.id,
          amount: plan.price,
          paid_on: start,
          method: String(f.get("method") || "cash"),
          note: `${plan.name} membership`,
        });
        if (payErr) throw payErr;
      }
      toast.success("Membership assigned.");
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const assignTraining = async (event: FormEvent<HTMLFormElement>, userId: string) => {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const workoutId = String(f.get("workout_template_id") || "") || null;
    const dietId = String(f.get("diet_template_id") || "") || null;
    try {
      await db.from("member_plans").update({ active: false }).eq("user_id", userId).eq("active", true);
      const { error } = await db.from("member_plans").insert({
        user_id: userId,
        workout_template_id: workoutId,
        diet_template_id: dietId,
        started_on: today(),
        active: true,
      });
      if (error) throw error;
      toast.success("Workout and diet assigned.");
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const setMembershipStatus = async (membershipId: string, status: string) => {
    const { error } = await db.from("memberships").update({ status }).eq("id", membershipId);
    if (error) toast.error(error.message);
    else {
      toast.success(status === "paused" ? "Membership paused." : "Membership reactivated.");
      reload();
    }
  };

  const extendMembership = async (m: Membership, months: number) => {
    const base = m.end_date >= today() ? m.end_date : today();
    const { error } = await db
      .from("memberships")
      .update({ end_date: addMonths(base, months), status: "active" })
      .eq("id", m.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Extended by ${months} month${months > 1 ? "s" : ""}.`);
      reload();
    }
  };

  return (
    <div className="space-y-6">
      <Panel
        title={`Members (${d.profiles.length})`}
        action={
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or phone"
            className={inputClass + " max-w-60"}
          />
        }
      >
        {rows.length === 0 ? (
          <Empty text="No members yet. Members appear here after they sign up." />
        ) : (
          <Table head={["Name", "Phone", "Category", "Plan ends", "Status", ""]}>
            {rows.map((p) => {
              const m = activeMembershipFor(d, p.id);
              const cat = categorizeMember(d, p.id);
              const live = cat === "active" || cat === "due_soon";
              return (
                <tr key={p.id} className="border-b border-border/60 align-top">
                  <td className="py-3 pr-4 font-semibold">{p.full_name || "—"}</td>
                  <td className="py-3 pr-4">{p.phone || "—"}</td>
                  <td className="py-3 pr-4">{CATEGORY_LABEL[cat]}</td>
                  <td className="py-3 pr-4">{m ? fmtDate(m.end_date) : "—"}</td>
                  <td className="py-3 pr-4">
                    <span className={live ? "text-primary" : "text-muted-foreground"}>
                      {live ? (cat === "due_soon" ? `${daysUntil(m!.end_date)}d left` : "Active") : m ? m.status : "None"}
                    </span>
                  </td>
                  <td className="py-3">
                    <Button variant="ghost" size="sm" onClick={() => setOpenId(openId === p.id ? null : p.id)}>
                      {openId === p.id ? "Close" : "Manage"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Panel>

      {openId && (
        <>
          <Panel title={`Membership — ${name(d, openId)}`}>
            {(() => {
              const current = activeMembershipFor(d, openId);
              return (
                <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
                  <span>
                    Current:{" "}
                    <strong>
                      {current
                        ? `${d.plans.find((p) => p.id === current.plan_id)?.name ?? "Plan"} · ${fmtDate(current.end_date)} · ${current.status}`
                        : "None"}
                    </strong>
                  </span>
                  {current && current.status === "active" && (
                    <Button variant="copperOutline" size="sm" onClick={() => void setMembershipStatus(current.id, "paused")}>
                      Pause
                    </Button>
                  )}
                  {current && current.status === "paused" && (
                    <Button variant="copperOutline" size="sm" onClick={() => void setMembershipStatus(current.id, "active")}>
                      Resume
                    </Button>
                  )}
                  {current && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => void extendMembership(current, 1)}>
                        +1 month
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void extendMembership(current, 3)}>
                        +3 months
                      </Button>
                    </>
                  )}
                </div>
              );
            })()}
            <form onSubmit={(e) => assign(e, openId)} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Plan">
                <select name="plan_id" required className={inputClass}>
                  {d.plans.filter((p) => p.active).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {inr(p.price)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Start date">
                <input type="date" name="start_date" defaultValue={today()} className={inputClass} />
              </Field>
              <Field label="Payment method">
                <select name="method" className={inputClass}>
                  {["cash", "upi", "card", "bank"].map((m) => (
                    <option key={m} value={m}>
                      {m.toUpperCase()}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex flex-col justify-end gap-3">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" name="record_payment" defaultChecked className="size-4 accent-[var(--color-primary)]" />
                  Record fee payment
                </label>
                <Button type="submit" variant="copper" size="editorial">
                  Save membership
                </Button>
              </div>
            </form>
            <div className="mt-6">
              <h4 className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Fee history</h4>
              {d.payments.filter((p) => p.user_id === openId).length === 0 ? (
                <Empty text="No payments recorded for this member." />
              ) : (
                <Table head={["Date", "Amount", "Method", "Note"]}>
                  {d.payments
                    .filter((p) => p.user_id === openId)
                    .map((p) => (
                      <tr key={p.id} className="border-b border-border/60">
                        <td className="py-3 pr-4">{fmtDate(p.paid_on)}</td>
                        <td className="py-3 pr-4">{inr(p.amount)}</td>
                        <td className="py-3 pr-4 uppercase">{p.method}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{p.note ?? "—"}</td>
                      </tr>
                    ))}
                </Table>
              )}
            </div>
          </Panel>

          <Panel title={`Training assignment — ${name(d, openId)}`}>
            {(() => {
              const mp = activeMemberPlanFor(d, openId);
              return (
                <p className="mb-4 text-sm text-muted-foreground">
                  Current workout:{" "}
                  <span className="text-foreground">
                    {mp?.workout_template_id
                      ? d.workouts.find((w) => w.id === mp.workout_template_id)?.name ?? "—"
                      : "None"}
                  </span>
                  {" · "}
                  Diet:{" "}
                  <span className="text-foreground">
                    {mp?.diet_template_id
                      ? d.diets.find((x) => x.id === mp.diet_template_id)?.name ?? "—"
                      : "None"}
                  </span>
                </p>
              );
            })()}
            <form onSubmit={(e) => assignTraining(e, openId)} className="grid gap-4 sm:grid-cols-3">
              <Field label="Workout template">
                <select name="workout_template_id" className={inputClass} defaultValue={activeMemberPlanFor(d, openId)?.workout_template_id ?? ""}>
                  <option value="">None</option>
                  {d.workouts.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Diet template">
                <select name="diet_template_id" className={inputClass} defaultValue={activeMemberPlanFor(d, openId)?.diet_template_id ?? ""}>
                  <option value="">None</option>
                  {d.diets.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex items-end">
                <Button type="submit" variant="copper" size="editorial" className="w-full">
                  Assign training
                </Button>
              </div>
            </form>
          </Panel>
        </>
      )}
    </div>
  );
}

function Plans({ d, reload }: { d: OwnerData; reload: () => void }) {
  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    try {
      const { error } = await db.from("membership_plans").insert({
        name: String(f.get("name")),
        months: Number(f.get("months")),
        price: Number(f.get("price")),
      });
      if (error) throw error;
      form.reset();
      toast.success("Plan added.");
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const toggle = async (plan: MembershipPlan) => {
    const { error } = await db.from("membership_plans").update({ active: !plan.active }).eq("id", plan.id);
    if (error) toast.error(error.message);
    else reload();
  };

  return (
    <div className="space-y-6">
      <Panel title="Add membership plan">
        <form onSubmit={add} className="grid gap-4 sm:grid-cols-4">
          <Field label="Name">
            <input name="name" required className={inputClass} placeholder="3 Months" />
          </Field>
          <Field label="Months">
            <input name="months" type="number" min={1} required className={inputClass} placeholder="3" />
          </Field>
          <Field label="Price (₹)">
            <input name="price" type="number" min={0} required className={inputClass} placeholder="3000" />
          </Field>
          <div className="flex items-end">
            <Button type="submit" variant="copper" size="editorial" className="w-full">
              Add plan
            </Button>
          </div>
        </form>
      </Panel>
      <Panel title="Plans">
        {d.plans.length === 0 ? (
          <Empty text="No plans yet." />
        ) : (
          <Table head={["Plan", "Months", "Price", "Status", ""]}>
            {d.plans.map((p) => (
              <tr key={p.id} className="border-b border-border/60">
                <td className="py-3 pr-4 font-semibold">{p.name}</td>
                <td className="py-3 pr-4">{p.months}</td>
                <td className="py-3 pr-4">{inr(p.price)}</td>
                <td className="py-3 pr-4">{p.active ? "Active" : "Hidden"}</td>
                <td className="py-3">
                  <Button variant="ghost" size="sm" onClick={() => toggle(p)}>
                    {p.active ? "Hide" : "Activate"}
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}

function nextBillNumber() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `EF-${stamp}-${rand}`;
}

type PhoneChannel = "whatsapp" | "sms";

function toPhoneDigits(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

function billRecipientName(d: OwnerData, bill: Bill) {
  if (bill.user_id) return name(d, bill.user_id);
  return bill.guest_name || "Guest";
}

function billPhone(d: OwnerData, bill: Bill) {
  if (bill.guest_phone) return bill.guest_phone;
  if (bill.user_id) return d.profiles.find((p) => p.id === bill.user_id)?.phone ?? null;
  return null;
}

function buildBillMessage(d: OwnerData, bill: Bill, channel: PhoneChannel) {
  const who = billRecipientName(d, bill);
  const heading = channel === "whatsapp" ? "*Evolution Fitness — Bill*" : "Evolution Fitness — Bill";
  const lines = [
    heading,
    `Bill No: ${bill.bill_number}`,
    `Name: ${who}`,
    `For: ${bill.title}`,
    `Category: ${labelOf(BILL_CATEGORIES, bill.category)}`,
    `Amount: ${inr(bill.amount)}`,
    `Billed: ${fmtDate(bill.billed_on)}`,
  ];
  if (bill.due_on) lines.push(`Due: ${fmtDate(bill.due_on)}`);
  if (bill.description) lines.push(`Details: ${bill.description}`);
  lines.push("", "Please pay at the Evolution Fitness desk or via UPI. Thank you!");
  return lines.join("\n");
}

function openBillOnPhone(phone: string, message: string, channel: PhoneChannel) {
  const digits = toPhoneDigits(phone);
  if (digits.length < 10) throw new Error("Phone number looks incomplete.");
  if (channel === "whatsapp") {
    window.open(
      `https://wa.me/${digits}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  } else {
    // Opens the device SMS app with the bill text pre-filled (for non-WhatsApp users).
    window.location.href = `sms:+${digits}?body=${encodeURIComponent(message)}`;
  }
  return digits;
}

function Billing({ d, reload }: { d: OwnerData; reload: () => void }) {
  const { user } = useAuth();
  const [recipient, setRecipient] = useState<"member" | "guest">("member");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedMemberId, setSelectedMemberId] = useState(d.profiles[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [phoneEditId, setPhoneEditId] = useState<string | null>(null);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [payBillId, setPayBillId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState("cash");
  const createIntent = useRef<"draft" | "site" | PhoneChannel>("draft");
  const formRef = useRef<HTMLFormElement>(null);

  const selectedMember = d.profiles.find((p) => p.id === selectedMemberId);
  const memberMembership = selectedMemberId ? activeMembershipFor(d, selectedMemberId) : undefined;
  const memberPlan = memberMembership
    ? d.plans.find((p) => p.id === memberMembership.plan_id)
    : undefined;

  const openBills = d.bills.filter((b) => b.status === "draft" || b.status === "sent");
  const openTotal = openBills.reduce((s, b) => s + Number(b.amount), 0);
  const filtered = d.bills.filter((b) => statusFilter === "all" || b.status === statusFilter);

  const suggestFromPlan = () => {
    if (!memberPlan) {
      toast.error("No active plan on this member to copy from.");
      return;
    }
    setTitle(memberPlan.name);
    setAmount(String(memberPlan.price));
  };

  const createBill = async (
    form: HTMLFormElement,
    intent: "draft" | "site" | PhoneChannel,
  ) => {
    const f = new FormData(form);
    const isMember = recipient === "member";
    const userId = isMember ? String(f.get("user_id") || "") : null;
    const guestName = isMember ? null : String(f.get("guest_name") || "").trim() || null;
    const guestPhoneRaw = String(f.get("guest_phone") || "").trim() || null;
    const guestPhone = isMember
      ? guestPhoneRaw || selectedMember?.phone || null
      : guestPhoneRaw;

    if (isMember && !userId) throw new Error("Select a member.");
    if (!isMember && !guestName) throw new Error("Enter the person's name.");
    if (intent === "site" && !userId) throw new Error("Send on site needs a member account.");
    if ((intent === "whatsapp" || intent === "sms") && !guestPhone) {
      throw new Error("Add a phone number to send the bill.");
    }

    const billTitle = String(f.get("title") || title).trim();
    const billAmount = Number(f.get("amount") || amount);
    if (!billTitle) throw new Error("Enter a bill title.");
    if (!(billAmount >= 0)) throw new Error("Enter a valid amount.");

    const row = {
      bill_number: nextBillNumber(),
      user_id: userId,
      guest_name: isMember ? null : guestName,
      guest_phone: guestPhone,
      category: String(f.get("category")),
      title: billTitle,
      description: String(f.get("description") || "").trim() || null,
      amount: billAmount,
      status: intent === "draft" ? "draft" : "sent",
      billed_on: String(f.get("billed_on") || today()),
      due_on: String(f.get("due_on") || "") || null,
      created_by: user?.id ?? null,
      note: String(f.get("note") || "").trim() || null,
      whatsapp_sent_at: null as string | null,
    };

    const { data: created, error } = await db.from("bills").insert(row).select("*").single();
    if (error) throw error;
    const bill = created as Bill;

    if (intent === "whatsapp" || intent === "sms") {
      openBillOnPhone(guestPhone!, buildBillMessage(d, bill, intent), intent);
      const stamp = new Date().toISOString();
      const patch =
        intent === "whatsapp"
          ? { whatsapp_sent_at: stamp, status: "sent" }
          : { sms_sent_at: stamp, status: "sent" };
      await db.from("bills").update(patch).eq("id", bill.id);
    }

    form.reset();
    setTitle("");
    setAmount("");
    return intent;
  };

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const intent = createIntent.current;
    setBusy(true);
    try {
      const result = await createBill(form, intent);
      toast.success(
        result === "whatsapp"
          ? "Bill recorded — WhatsApp opened."
          : result === "sms"
            ? "Bill recorded — SMS app opened."
            : result === "site"
              ? "Bill recorded and sent on site."
              : "Bill recorded as draft.",
      );
      createIntent.current = "draft";
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const submitWith = (intent: "draft" | "site" | PhoneChannel) => {
    createIntent.current = intent;
    formRef.current?.requestSubmit();
  };

  const setStatus = async (bill: Bill, status: string, extra: Record<string, unknown> = {}) => {
    const { error } = await db.from("bills").update({ status, ...extra }).eq("id", bill.id);
    if (error) toast.error(error.message);
    else {
      toast.success(status === "paid" ? "Marked paid." : status === "sent" ? "Sent on site." : "Updated.");
      reload();
    }
  };

  const sendOnSite = async (bill: Bill) => {
    if (!bill.user_id) {
      toast.error("This bill has no member account. Use WhatsApp or SMS instead.");
      return;
    }
    await setStatus(bill, "sent");
  };

  const sendOnPhone = async (bill: Bill, channel: PhoneChannel) => {
    const phone = billPhone(d, bill);
    if (!phone) {
      setPhoneEditId(bill.id);
      setPhoneDraft("");
      toast.error(`Add a phone number, then tap ${channel === "whatsapp" ? "WhatsApp" : "SMS"} again.`);
      return;
    }
    try {
      openBillOnPhone(phone, buildBillMessage(d, bill, channel), channel);
      const stamp = new Date().toISOString();
      const patch: Record<string, unknown> =
        channel === "whatsapp" ? { whatsapp_sent_at: stamp } : { sms_sent_at: stamp };
      if (bill.status === "draft") patch["status"] = "sent";
      const { error } = await db.from("bills").update(patch).eq("id", bill.id);
      if (error) toast.error(error.message);
      else {
        toast.success(
          channel === "whatsapp"
            ? "WhatsApp opened — bill marked sent."
            : "SMS app opened — bill marked sent.",
        );
        reload();
      }
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const savePhone = async (bill: Bill) => {
    const phone = phoneDraft.trim();
    if (!phone) {
      toast.error("Enter a phone number.");
      return;
    }
    const { error } = await db.from("bills").update({ guest_phone: phone }).eq("id", bill.id);
    if (error) toast.error(error.message);
    else {
      setPhoneEditId(null);
      toast.success("Phone saved.");
      reload();
    }
  };

  const markPaid = async (bill: Bill) => {
    try {
      setBusy(true);
      let paymentId: string | null = bill.payment_id;
      if (bill.user_id && !paymentId) {
        const membership = activeMembershipFor(d, bill.user_id);
        const { data: payment, error: payErr } = await db
          .from("payments")
          .insert({
            user_id: bill.user_id,
            membership_id: membership?.id ?? null,
            amount: bill.amount,
            paid_on: today(),
            method: payMethod,
            note: `Bill ${bill.bill_number}: ${bill.title}`,
          })
          .select("id")
          .single();
        if (payErr) throw payErr;
        paymentId = payment.id;
      }
      await setStatus(bill, "paid", { paid_on: today(), payment_id: paymentId });
      setPayBillId(null);
      setPayMethod("cash");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Open bills" value={String(openBills.length)} hint={`${inr(openTotal)} outstanding`} />
        <Stat
          label="Paid"
          value={String(d.bills.filter((b) => b.status === "paid").length)}
          hint="Recorded as paid"
        />
        <Stat label="All bills" value={String(d.bills.length)} hint="Members + walk-ins" />
      </div>

      <Panel title="Generate a bill">
        <form ref={formRef} onSubmit={(e) => void onCreate(e)} className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={recipient === "member" ? "copper" : "ghost"}
              size="sm"
              onClick={() => setRecipient("member")}
            >
              Gym member
            </Button>
            <Button
              type="button"
              variant={recipient === "guest" ? "copper" : "ghost"}
              size="sm"
              onClick={() => setRecipient("guest")}
            >
              New / walk-in person
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recipient === "member" ? (
              <>
                <Field label="Member">
                  <select
                    name="user_id"
                    required
                    className={inputClass}
                    value={selectedMemberId}
                    onChange={(e) => {
                      setSelectedMemberId(e.target.value);
                      setTitle("");
                      setAmount("");
                    }}
                  >
                    {d.profiles.length === 0 ? (
                      <option value="">No members yet</option>
                    ) : (
                      d.profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name || p.phone || p.id.slice(0, 8)}
                        </option>
                      ))
                    )}
                  </select>
                </Field>
                <Field label="Phone number">
                  <input
                    name="guest_phone"
                    className={inputClass}
                    placeholder={selectedMember?.phone || "Uses profile phone if blank"}
                  />
                </Field>
                {memberPlan && (
                  <div className="flex items-end">
                    <Button type="button" variant="copperOutline" size="sm" className="w-full" onClick={suggestFromPlan}>
                      Use plan: {memberPlan.name} · {inr(memberPlan.price)}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>
                <Field label="Person name">
                  <input name="guest_name" required className={inputClass} placeholder="Full name" />
                </Field>
                <Field label="Phone number">
                  <input name="guest_phone" className={inputClass} placeholder="10-digit mobile" />
                </Field>
              </>
            )}
            <Field label="Category">
              <select name="category" className={inputClass} defaultValue="membership">
                {BILL_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Title">
              <input
                name="title"
                required
                className={inputClass}
                placeholder="e.g. 3-month membership"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label="Amount (₹)">
              <input
                name="amount"
                type="number"
                min={0}
                required
                className={inputClass}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="Billed on">
              <input name="billed_on" type="date" defaultValue={today()} className={inputClass} />
            </Field>
            <Field label="Due on">
              <input name="due_on" type="date" className={inputClass} />
            </Field>
            <Field label="Details">
              <input name="description" className={inputClass} placeholder="Optional line item detail" />
            </Field>
            <Field label="Internal note">
              <input name="note" className={inputClass} placeholder="Optional" />
            </Field>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button
              type="submit"
              variant="copperOutline"
              size="editorial"
              disabled={busy}
              onClick={() => {
                createIntent.current = "draft";
              }}
            >
              Save draft
            </Button>
            {recipient === "member" && (
              <Button
                type="button"
                variant="copper"
                size="editorial"
                disabled={busy || !selectedMemberId}
                onClick={() => submitWith("site")}
              >
                Save & send on site
              </Button>
            )}
            <Button
              type="button"
              variant="copper"
              size="editorial"
              disabled={busy}
              onClick={() => submitWith("whatsapp")}
            >
              Save & WhatsApp
            </Button>
            <Button
              type="button"
              variant="copperOutline"
              size="editorial"
              disabled={busy}
              onClick={() => submitWith("sms")}
            >
              Save & SMS
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Members with accounts see sent bills in their app. For others, choose WhatsApp or SMS
            (text message). Run <code className="text-foreground">supabase/bills.sql</code> once if
            save fails.
          </p>
        </form>
      </Panel>

      <Panel
        title="Bill ledger"
        action={
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={inputClass + " max-w-40"}
          >
            <option value="all">All statuses</option>
            {BILL_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        }
      >
        {filtered.length === 0 ? (
          <Empty text="No bills yet. Generate one above for a member or walk-in." />
        ) : (
          <Table head={["Bill", "Person", "Amount", "Status", "Send", ""]}>
            {filtered.map((bill) => {
              const phone = billPhone(d, bill);
              const hasAccount = Boolean(bill.user_id);
              const editingPhone = phoneEditId === bill.id;
              const confirmingPay = payBillId === bill.id;
              return (
                <tr key={bill.id} className="border-b border-border/60 align-top">
                  <td className="py-3 pr-4">
                    <p className="font-semibold">{bill.bill_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {bill.title} · {labelOf(BILL_CATEGORIES, bill.category)}
                    </p>
                    <p className="text-xs text-muted-foreground">{fmtDate(bill.billed_on)}</p>
                  </td>
                  <td className="py-3 pr-4">
                    <p className="font-semibold">{billRecipientName(d, bill)}</p>
                    <p className="text-xs text-muted-foreground">
                      {hasAccount ? "Member account" : "Walk-in"}
                      {phone ? ` · ${phone}` : " · no phone"}
                    </p>
                    {editingPhone && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <input
                          className={inputClass + " max-w-40"}
                          placeholder="Mobile number"
                          value={phoneDraft}
                          onChange={(e) => setPhoneDraft(e.target.value)}
                        />
                        <Button size="sm" variant="copper" onClick={() => void savePhone(bill)}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setPhoneEditId(null)}>
                          Cancel
                        </Button>
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-4 font-semibold">{inr(bill.amount)}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={
                        bill.status === "paid"
                          ? "text-primary"
                          : bill.status === "cancelled"
                            ? "text-muted-foreground"
                            : ""
                      }
                    >
                      {labelOf(BILL_STATUSES, bill.status)}
                    </span>
                    {bill.whatsapp_sent_at && (
                      <p className="text-[10px] text-muted-foreground">WA {fmtDate(bill.whatsapp_sent_at)}</p>
                    )}
                    {bill.sms_sent_at && (
                      <p className="text-[10px] text-muted-foreground">SMS {fmtDate(bill.sms_sent_at)}</p>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-col gap-1">
                      {hasAccount && bill.status !== "paid" && bill.status !== "cancelled" && (
                        <Button variant="copperOutline" size="sm" onClick={() => void sendOnSite(bill)}>
                          {bill.status === "sent" ? "Resend on site" : "Send on site"}
                        </Button>
                      )}
                      {bill.status !== "cancelled" && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => void sendOnPhone(bill, "whatsapp")}>
                            WhatsApp
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => void sendOnPhone(bill, "sms")}>
                            SMS
                          </Button>
                        </>
                      )}
                      {!phone && bill.status !== "cancelled" && !editingPhone && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPhoneEditId(bill.id);
                            setPhoneDraft("");
                          }}
                        >
                          Add phone
                        </Button>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-col gap-1">
                      {bill.status !== "paid" && bill.status !== "cancelled" && !confirmingPay && (
                        <Button
                          variant="copper"
                          size="sm"
                          onClick={() => {
                            setPayBillId(bill.id);
                            setPayMethod("cash");
                          }}
                        >
                          Mark paid
                        </Button>
                      )}
                      {confirmingPay && (
                        <div className="space-y-2">
                          {bill.user_id ? (
                            <select
                              className={inputClass}
                              value={payMethod}
                              onChange={(e) => setPayMethod(e.target.value)}
                            >
                              {["cash", "upi", "card", "bank"].map((m) => (
                                <option key={m} value={m}>
                                  {m.toUpperCase()}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <p className="text-[10px] text-muted-foreground">Walk-in — no fee row</p>
                          )}
                          <Button size="sm" variant="copper" disabled={busy} onClick={() => void markPaid(bill)}>
                            Confirm paid
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setPayBillId(null)}>
                            Back
                          </Button>
                        </div>
                      )}
                      {bill.status !== "cancelled" && bill.status !== "paid" && !confirmingPay && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void setStatus(bill, "cancelled")}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Panel>
    </div>
  );
}

function Fees({ d, reload }: { d: OwnerData; reload: () => void }) {
  const [groupBy, setGroupBy] = useState<"list" | "month" | "method" | "member">("list");
  const [methodFilter, setMethodFilter] = useState("all");

  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    try {
      const userId = String(f.get("user_id"));
      const membership = activeMembershipFor(d, userId);
      const { error } = await db.from("payments").insert({
        user_id: userId,
        membership_id: membership?.id ?? null,
        amount: Number(f.get("amount")),
        paid_on: String(f.get("paid_on")),
        method: String(f.get("method")),
        note: String(f.get("note") || "") || null,
      });
      if (error) throw error;
      form.reset();
      toast.success("Payment recorded.");
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const filtered = d.payments.filter((p) => methodFilter === "all" || p.method === methodFilter);
  const total = filtered.reduce((s, p) => s + Number(p.amount), 0);

  const grouped = useMemo(() => {
    const map = new Map<string, { key: string; total: number; count: number }>();
    for (const p of filtered) {
      const key =
        groupBy === "month"
          ? p.paid_on.slice(0, 7)
          : groupBy === "method"
            ? p.method.toUpperCase()
            : groupBy === "member"
              ? name(d, p.user_id)
              : p.id;
      const row = map.get(key) ?? { key, total: 0, count: 0 };
      row.total += Number(p.amount);
      row.count += 1;
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [filtered, groupBy, d]);

  return (
    <div className="space-y-6">
      <Panel title="Record a fee payment">
        <form onSubmit={add} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Member">
            <select name="user_id" required className={inputClass}>
              {d.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.phone || p.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount (₹)">
            <input name="amount" type="number" min={0} required className={inputClass} />
          </Field>
          <Field label="Date">
            <input name="paid_on" type="date" defaultValue={today()} className={inputClass} />
          </Field>
          <Field label="Method">
            <select name="method" className={inputClass}>
              {["cash", "upi", "card", "bank"].map((m) => (
                <option key={m} value={m}>
                  {m.toUpperCase()}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <Button type="submit" variant="copper" size="editorial" className="w-full">
              Save
            </Button>
          </div>
          <Field label="Note">
            <input name="note" className={inputClass} placeholder="Optional" />
          </Field>
        </form>
      </Panel>

      <Panel
        title={`Payment history — ${inr(total)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className={inputClass + " max-w-32"}
            >
              <option value="all">All methods</option>
              {["cash", "upi", "card", "bank"].map((m) => (
                <option key={m} value={m}>
                  {m.toUpperCase()}
                </option>
              ))}
            </select>
            {(
              [
                ["list", "List"],
                ["month", "By month"],
                ["method", "By method"],
                ["member", "By member"],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                variant={groupBy === id ? "copper" : "ghost"}
                size="sm"
                onClick={() => setGroupBy(id)}
              >
                {label}
              </Button>
            ))}
          </div>
        }
      >
        {filtered.length === 0 ? (
          <Empty text="No payments recorded yet." />
        ) : groupBy === "list" ? (
          <Table head={["Date", "Member", "Amount", "Method", "Note"]}>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-border/60">
                <td className="py-3 pr-4">{fmtDate(p.paid_on)}</td>
                <td className="py-3 pr-4">{name(d, p.user_id)}</td>
                <td className="py-3 pr-4 font-semibold">{inr(p.amount)}</td>
                <td className="py-3 pr-4 uppercase">{p.method}</td>
                <td className="py-3 pr-4 text-muted-foreground">{p.note ?? "—"}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Table head={[groupBy === "month" ? "Month" : groupBy === "method" ? "Method" : "Member", "Payments", "Total"]}>
            {grouped.map((g) => (
              <tr key={g.key} className="border-b border-border/60">
                <td className="py-3 pr-4 font-semibold">{g.key}</td>
                <td className="py-3 pr-4">{g.count}</td>
                <td className="py-3 pr-4">{inr(g.total)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}

function Expenses({ d, reload }: { d: OwnerData; reload: () => void }) {
  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    try {
      const { error } = await db.from("expenses").insert({
        category: String(f.get("category")),
        amount: Number(f.get("amount")),
        spent_on: String(f.get("spent_on")),
        note: String(f.get("note") || "") || null,
      });
      if (error) throw error;
      form.reset();
      toast.success("Expense added.");
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="space-y-6">
      <Panel title="Add expense">
        <form onSubmit={add} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Category">
            <select name="category" className={inputClass}>
              {["Rent", "Electricity", "Equipment", "Staff", "Maintenance", "Marketing", "Other"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Amount (₹)">
            <input name="amount" type="number" min={0} required className={inputClass} />
          </Field>
          <Field label="Date">
            <input name="spent_on" type="date" defaultValue={today()} className={inputClass} />
          </Field>
          <Field label="Note">
            <input name="note" className={inputClass} placeholder="Optional" />
          </Field>
          <div className="flex items-end">
            <Button type="submit" variant="copper" size="editorial" className="w-full">
              Save
            </Button>
          </div>
        </form>
      </Panel>
      <Panel title={`Expenses — ${inr(d.expenses.reduce((s, e) => s + Number(e.amount), 0))}`}>
        {d.expenses.length === 0 ? (
          <Empty text="No expenses recorded yet." />
        ) : (
          <Table head={["Date", "Category", "Amount", "Note"]}>
            {d.expenses.map((e) => (
              <tr key={e.id} className="border-b border-border/60">
                <td className="py-3 pr-4">{fmtDate(e.spent_on)}</td>
                <td className="py-3 pr-4 font-semibold">{e.category}</td>
                <td className="py-3 pr-4">{inr(e.amount)}</td>
                <td className="py-3 pr-4 text-muted-foreground">{e.note ?? "—"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}

function AttendanceTab({ d, reload }: { d: OwnerData; reload: () => void }) {
  const byDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of d.attendance) map.set(a.attended_on, (map.get(a.attended_on) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14);
  }, [d]);

  const deskCheckIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    const userId = String(f.get("user_id"));
    const date = String(f.get("attended_on") || today());
    try {
      const { error } = await db.from("attendance").upsert(
        { user_id: userId, attended_on: date, source: "desk" },
        { onConflict: "user_id,attended_on" },
      );
      if (error) throw error;
      toast.success(`Checked in ${name(d, userId)}.`);
      form.reset();
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="space-y-6">
      <Panel title="Desk check-in">
        <form onSubmit={deskCheckIn} className="grid gap-4 sm:grid-cols-3">
          <Field label="Member">
            <select name="user_id" required className={inputClass}>
              {d.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.phone || p.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input type="date" name="attended_on" defaultValue={today()} className={inputClass} />
          </Field>
          <div className="flex items-end">
            <Button type="submit" variant="copper" size="editorial" className="w-full">
              Mark present
            </Button>
          </div>
        </form>
      </Panel>
      <Panel title="Check-ins by day">
        {byDate.length === 0 ? (
          <Empty text="No attendance yet. Members check in from their app, or use desk check-in above." />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[...byDate].reverse().map(([date, count]) => ({ date: date.slice(5), count }))}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-foreground)",
                  }}
                />
                <Bar dataKey="count" fill="var(--color-primary)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>
      <Panel title="Recent check-ins">
        {d.attendance.length === 0 ? (
          <Empty text="No check-ins recorded." />
        ) : (
          <Table head={["Date", "Member", "Source"]}>
            {d.attendance.slice(0, 40).map((a) => (
              <tr key={a.id} className="border-b border-border/60">
                <td className="py-3 pr-4">{fmtDate(a.attended_on)}</td>
                <td className="py-3 pr-4">{name(d, a.user_id)}</td>
                <td className="py-3 pr-4 capitalize text-muted-foreground">{a.source ?? "self"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}

function Templates({ d, reload }: { d: OwnerData; reload: () => void }) {
  const addWorkout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    try {
      const { error } = await db.from("workout_templates").insert({
        name: String(f.get("name")),
        goal: String(f.get("goal")),
        experience_level: String(f.get("experience_level")),
        days_per_week: Number(f.get("days_per_week")),
        description: String(f.get("description") || "") || null,
      });
      if (error) throw error;
      form.reset();
      toast.success("Workout template added.");
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const addDiet = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    try {
      const { error } = await db.from("diet_templates").insert({
        name: String(f.get("name")),
        goal: String(f.get("goal")),
        diet_preference: String(f.get("diet_preference")),
        calories: Number(f.get("calories")) || null,
        description: String(f.get("description") || "") || null,
      });
      if (error) throw error;
      form.reset();
      toast.success("Diet template added.");
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="space-y-6">
      <Disclaimer>
        Templates are reusable guidance, not medical advice. Members are told to consult a qualified
        professional before following any diet or training programme.
      </Disclaimer>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="New workout template">
          <form onSubmit={addWorkout} className="space-y-4">
            <Field label="Name">
              <input name="name" required className={inputClass} placeholder="Strength Base 4-Day" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Goal">
                <select name="goal" className={inputClass}>
                  {GOALS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Level">
                <select name="experience_level" className={inputClass}>
                  {LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Days / week">
                <select name="days_per_week" className={inputClass}>
                  {[3, 4, 5, 6].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Description">
              <input name="description" className={inputClass} placeholder="Short summary" />
            </Field>
            <Button type="submit" variant="copper" size="editorial" className="w-full">
              Add workout template
            </Button>
          </form>
          <div className="mt-6 space-y-2">
            {d.workouts.map((w) => (
              <p key={w.id} className="border-b border-border/60 pb-2 text-sm">
                <span className="font-semibold">{w.name}</span>{" "}
                <span className="text-muted-foreground">
                  · {labelOf(GOALS, w.goal)} · {labelOf(LEVELS, w.experience_level)} · {w.days_per_week} days
                </span>
              </p>
            ))}
            {d.workouts.length === 0 && <Empty text="No workout templates yet." />}
          </div>
        </Panel>

        <Panel title="New diet template">
          <form onSubmit={addDiet} className="space-y-4">
            <Field label="Name">
              <input name="name" required className={inputClass} placeholder="Lean Vegetarian 1800" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Goal">
                <select name="goal" className={inputClass}>
                  {GOALS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Diet">
                <select name="diet_preference" className={inputClass}>
                  {DIETS.map((x) => (
                    <option key={x.value} value={x.value}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Calories">
                <input name="calories" type="number" min={0} className={inputClass} placeholder="1800" />
              </Field>
            </div>
            <Field label="Description">
              <input name="description" className={inputClass} placeholder="Short summary" />
            </Field>
            <Button type="submit" variant="copper" size="editorial" className="w-full">
              Add diet template
            </Button>
          </form>
          <div className="mt-6 space-y-2">
            {d.diets.map((x) => (
              <p key={x.id} className="border-b border-border/60 pb-2 text-sm">
                <span className="font-semibold">{x.name}</span>{" "}
                <span className="text-muted-foreground">
                  · {labelOf(GOALS, x.goal)} · {labelOf(DIETS, x.diet_preference)}
                  {x.calories ? ` · ${x.calories} kcal` : ""}
                </span>
              </p>
            ))}
            {d.diets.length === 0 && <Empty text="No diet templates yet." />}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Advice({ d, reload }: { d: OwnerData; reload: () => void }) {
  const { user } = useAuth();
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const send = async (event: FormEvent<HTMLFormElement>, requestId: string) => {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    try {
      const { error } = await db
        .from("advice_replies")
        .insert({ request_id: requestId, author_id: user!.id, message: String(f.get("message")) });
      if (error) throw error;
      await db.from("advice_requests").update({ status: "answered" }).eq("id", requestId);
      toast.success("Reply sent.");
      setReplyTo(null);
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  if (d.requests.length === 0)
    return <Panel title="Advice requests"><Empty text="No member questions yet." /></Panel>;

  return (
    <div className="space-y-4">
      {d.requests.map((r) => (
        <Panel key={r.id} title={r.subject}>
          <p className="text-xs uppercase tracking-[0.16em] text-primary">
            {name(d, r.user_id)} · {fmtDate(r.created_at)} · {r.status}
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{r.message}</p>
          {r.advice_replies?.map((rep) => (
            <p key={rep.id} className="mt-4 border-l-2 border-primary/60 pl-4 text-sm leading-6">
              {rep.message}
            </p>
          ))}
          {replyTo === r.id ? (
            <form onSubmit={(e) => send(e, r.id)} className="mt-4 space-y-3">
              <textarea name="message" required rows={3} className={inputClass + " h-auto py-3"} placeholder="Your reply" />
              <div className="flex gap-2">
                <Button type="submit" variant="copper" size="sm">
                  Send reply
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setReplyTo(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <Button variant="copperOutline" size="sm" className="mt-4" onClick={() => setReplyTo(r.id)}>
              Reply
            </Button>
          )}
        </Panel>
      ))}
    </div>
  );
}
