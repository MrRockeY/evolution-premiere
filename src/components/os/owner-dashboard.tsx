import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Disclaimer, Empty, Field, Loading, Panel, Stat, TabBar, Table, inputClass } from "@/components/os/ui";
import { Button } from "@/components/ui/button";
import { addMonths, db, errMsg, today, useAsyncData } from "@/lib/db";
import {
  fmtDate,
  inr,
  labelOf,
  DIETS,
  GOALS,
  LEVELS,
  type AdviceRequest,
  type Attendance,
  type DietTemplate,
  type Expense,
  type Membership,
  type MembershipPlan,
  type Payment,
  type Profile,
  type ProgressEntry,
  type WorkoutTemplate,
} from "@/lib/domain";
import { useAuth } from "@/hooks/useAuth";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "members", label: "Members" },
  { id: "plans", label: "Plans" },
  { id: "fees", label: "Fees" },
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
  expenses: Expense[];
  attendance: Attendance[];
  workouts: WorkoutTemplate[];
  diets: DietTemplate[];
  requests: (AdviceRequest & { advice_replies: { id: string; message: string; created_at: string }[] })[];
  progress: ProgressEntry[];
};

export default function OwnerDashboard() {
  const [tab, setTab] = useState<TabId>("overview");
  const { data, loading, reload } = useAsyncData<OwnerData>(async () => {
    const [profiles, plans, memberships, payments, expenses, attendance, workouts, diets, requests, progress] =
      await Promise.all([
        db.from("profiles").select("*").order("created_at", { ascending: false }),
        db.from("membership_plans").select("*").order("months"),
        db.from("memberships").select("*").order("end_date", { ascending: false }),
        db.from("payments").select("*").order("paid_on", { ascending: false }),
        db.from("expenses").select("*").order("spent_on", { ascending: false }),
        db.from("attendance").select("*").order("attended_on", { ascending: false }).limit(300),
        db.from("workout_templates").select("*").order("created_at"),
        db.from("diet_templates").select("*").order("created_at"),
        db
          .from("advice_requests")
          .select("*, advice_replies(id, message, created_at)")
          .order("created_at", { ascending: false }),
        db.from("progress_entries").select("*").order("entry_date", { ascending: false }).limit(300),
      ]);
    const firstError = [profiles, plans, memberships, payments, expenses, attendance, workouts, diets, requests, progress].find(
      (r) => r.error,
    );
    return {
      data: {
        profiles: (profiles.data ?? []) as Profile[],
        plans: (plans.data ?? []) as MembershipPlan[],
        memberships: (memberships.data ?? []) as Membership[],
        payments: (payments.data ?? []) as Payment[],
        expenses: (expenses.data ?? []) as Expense[],
        attendance: (attendance.data ?? []) as Attendance[],
        workouts: (workouts.data ?? []) as WorkoutTemplate[],
        diets: (diets.data ?? []) as DietTemplate[],
        requests: (requests.data ?? []) as OwnerData["requests"],
        progress: (progress.data ?? []) as ProgressEntry[],
      },
      error: firstError?.error ? { message: firstError.error.message } : null,
    };
  }, []);

  if (loading || !data) return <Loading />;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Owner console</p>
        <h1 className="mt-2 font-display text-5xl font-black uppercase leading-none sm:text-6xl">
          Run the floor.
        </h1>
      </div>
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab === "overview" && <Overview d={data} />}
      {tab === "members" && <Members d={data} reload={reload} />}
      {tab === "plans" && <Plans d={data} reload={reload} />}
      {tab === "fees" && <Fees d={data} reload={reload} />}
      {tab === "expenses" && <Expenses d={data} reload={reload} />}
      {tab === "attendance" && <AttendanceTab d={data} />}
      {tab === "templates" && <Templates d={data} reload={reload} />}
      {tab === "advice" && <Advice d={data} reload={reload} />}
    </div>
  );
}

const name = (d: OwnerData, id: string) =>
  d.profiles.find((p) => p.id === id)?.full_name || "Member";

function Overview({ d }: { d: OwnerData }) {
  const revenue = d.payments.reduce((s, p) => s + Number(p.amount), 0);
  const spend = d.expenses.reduce((s, e) => s + Number(e.amount), 0);
  const active = d.memberships.filter((m) => m.status === "active" && m.end_date >= today()).length;
  const todayCount = d.attendance.filter((a) => a.attended_on === today()).length;

  const chart = useMemo(() => {
    const map = new Map<string, { month: string; revenue: number; expenses: number }>();
    const key = (iso: string) => iso.slice(0, 7);
    for (const p of d.payments) {
      const k = key(p.paid_on);
      const row = map.get(k) ?? { month: k, revenue: 0, expenses: 0 };
      row.revenue += Number(p.amount);
      map.set(k, row);
    }
    for (const e of d.expenses) {
      const k = key(e.spent_on);
      const row = map.get(k) ?? { month: k, revenue: 0, expenses: 0 };
      row.expenses += Number(e.amount);
      map.set(k, row);
    }
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  }, [d]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total collected" value={inr(revenue)} hint={`${d.payments.length} payments`} />
        <Stat label="Total expenses" value={inr(spend)} hint={`${d.expenses.length} entries`} />
        <Stat label="Net" value={inr(revenue - spend)} hint="Collected minus expenses" />
        <Stat label="Active memberships" value={String(active)} hint={`${todayCount} checked in today`} />
      </div>
      <Panel title="Revenue vs expenses">
        {chart.length === 0 ? (
          <Empty text="No payments or expenses recorded yet." />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-foreground)",
                  }}
                />
                <Bar dataKey="revenue" fill="var(--color-primary)" />
                <Bar dataKey="expenses" fill="var(--color-muted-foreground)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>
      <Panel title="Latest member progress">
        {d.progress.length === 0 ? (
          <Empty text="Members have not logged progress yet." />
        ) : (
          <Table head={["Member", "Date", "Weight", "Waist", "Note"]}>
            {d.progress.slice(0, 8).map((p) => (
              <tr key={p.id} className="border-b border-border/60">
                <td className="py-3 pr-4">{name(d, p.user_id)}</td>
                <td className="py-3 pr-4">{fmtDate(p.entry_date)}</td>
                <td className="py-3 pr-4">{p.weight_kg ? `${p.weight_kg} kg` : "—"}</td>
                <td className="py-3 pr-4">{p.waist_cm ? `${p.waist_cm} cm` : "—"}</td>
                <td className="py-3 pr-4 text-muted-foreground">{p.note ?? "—"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}

function Members({ d, reload }: { d: OwnerData; reload: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const rows = d.profiles.filter((p) =>
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
      const { data: created, error } = await db
        .from("memberships")
        .insert({ user_id: userId, plan_id: plan.id, start_date: start, end_date: addMonths(start, plan.months), status: "active" })
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
          <Table head={["Name", "Phone", "Goal", "Level", "Membership ends", "Status", ""]}>
            {rows.map((p) => {
              const m = d.memberships.find((x) => x.user_id === p.id);
              const activeM = m && m.end_date >= today() && m.status === "active";
              return (
                <tr key={p.id} className="border-b border-border/60 align-top">
                  <td className="py-3 pr-4 font-semibold">{p.full_name || "—"}</td>
                  <td className="py-3 pr-4">{p.phone || "—"}</td>
                  <td className="py-3 pr-4">{labelOf(GOALS, p.goal)}</td>
                  <td className="py-3 pr-4">{labelOf(LEVELS, p.experience_level)}</td>
                  <td className="py-3 pr-4">{m ? fmtDate(m.end_date) : "—"}</td>
                  <td className="py-3 pr-4">
                    <span className={activeM ? "text-primary" : "text-muted-foreground"}>
                      {activeM ? "Active" : m ? "Expired" : "None"}
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
        <Panel title={`Assign membership — ${name(d, openId)}`}>
          <form onSubmit={(e) => assign(e, openId)} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Plan">
              <select name="plan_id" required className={inputClass}>
                {d.plans.map((p) => (
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

function Fees({ d, reload }: { d: OwnerData; reload: () => void }) {
  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    try {
      const { error } = await db.from("payments").insert({
        user_id: String(f.get("user_id")),
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

  return (
    <div className="space-y-6">
      <Panel title="Record a fee payment">
        <form onSubmit={add} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Member">
            <select name="user_id" required className={inputClass}>
              {d.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.id.slice(0, 8)}
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
      <Panel title={`Payment history — ${inr(d.payments.reduce((s, p) => s + Number(p.amount), 0))}`}>
        {d.payments.length === 0 ? (
          <Empty text="No payments recorded yet." />
        ) : (
          <Table head={["Date", "Member", "Amount", "Method", "Note"]}>
            {d.payments.map((p) => (
              <tr key={p.id} className="border-b border-border/60">
                <td className="py-3 pr-4">{fmtDate(p.paid_on)}</td>
                <td className="py-3 pr-4">{name(d, p.user_id)}</td>
                <td className="py-3 pr-4 font-semibold">{inr(p.amount)}</td>
                <td className="py-3 pr-4 uppercase">{p.method}</td>
                <td className="py-3 pr-4 text-muted-foreground">{p.note ?? "—"}</td>
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

function AttendanceTab({ d }: { d: OwnerData }) {
  const byDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of d.attendance) map.set(a.attended_on, (map.get(a.attended_on) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14);
  }, [d]);

  return (
    <div className="space-y-6">
      <Panel title="Check-ins by day">
        {byDate.length === 0 ? (
          <Empty text="No attendance yet. Members check themselves in from their dashboard." />
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
          <Table head={["Date", "Member"]}>
            {d.attendance.slice(0, 40).map((a) => (
              <tr key={a.id} className="border-b border-border/60">
                <td className="py-3 pr-4">{fmtDate(a.attended_on)}</td>
                <td className="py-3 pr-4">{name(d, a.user_id)}</td>
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
