import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Disclaimer, Empty, Field, Loading, Panel, Stat, TabBar, Table, inputClass } from "@/components/os/ui";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { db, errMsg, today, useAsyncData } from "@/lib/db";
import {
  DIETS,
  GOALS,
  LEVELS,
  fmtDate,
  inr,
  labelOf,
  type AdviceRequest,
  type Attendance,
  type DietMeal,
  type DietTemplate,
  type Exercise,
  type MemberPlan,
  type Membership,
  type MembershipPlan,
  type Payment,
  type ProgressEntry,
  type WorkoutLog,
  type WorkoutTemplate,
  type WorkoutTemplateDay,
  type WorkoutTemplateItem,
} from "@/lib/domain";

const TABS = [
  { id: "home", label: "Home" },
  { id: "profile", label: "Profile" },
  { id: "membership", label: "Membership" },
  { id: "workout", label: "Workout" },
  { id: "diet", label: "Diet" },
  { id: "library", label: "Exercises" },
  { id: "checkin", label: "Check-in" },
  { id: "progress", label: "Progress" },
  { id: "trainer", label: "Ask Trainer" },
] as const;

type TabId = (typeof TABS)[number]["id"];

type DayWithItems = WorkoutTemplateDay & {
  workout_template_items: (WorkoutTemplateItem & { exercises: Exercise | null })[];
};

type CustomerData = {
  memberships: Membership[];
  plans: MembershipPlan[];
  payments: Payment[];
  attendance: Attendance[];
  memberPlans: MemberPlan[];
  workouts: WorkoutTemplate[];
  diets: DietTemplate[];
  workoutDays: DayWithItems[];
  meals: DietMeal[];
  exercises: Exercise[];
  logs: WorkoutLog[];
  progress: ProgressEntry[];
  requests: (AdviceRequest & { advice_replies: { id: string; message: string; created_at: string }[] })[];
};

export default function CustomerDashboard() {
  const { user, profile, refreshProfile } = useAuth();
  const [tab, setTab] = useState<TabId>("home");
  const uid = user!.id;

  const { data, loading, reload } = useAsyncData<CustomerData>(async () => {
    const [
      memberships,
      plans,
      payments,
      attendance,
      memberPlans,
      workouts,
      diets,
      workoutDays,
      meals,
      exercises,
      logs,
      progress,
      requests,
    ] = await Promise.all([
      db.from("memberships").select("*").eq("user_id", uid).order("end_date", { ascending: false }),
      db.from("membership_plans").select("*").order("months"),
      db.from("payments").select("*").eq("user_id", uid).order("paid_on", { ascending: false }),
      db.from("attendance").select("*").eq("user_id", uid).order("attended_on", { ascending: false }).limit(90),
      db.from("member_plans").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
      db.from("workout_templates").select("*").order("created_at"),
      db.from("diet_templates").select("*").order("created_at"),
      db
        .from("workout_template_days")
        .select("*, workout_template_items(*, exercises(*))")
        .order("day_number"),
      db.from("diet_template_meals").select("*").order("position"),
      db.from("exercises").select("*").order("muscle_group").order("name"),
      db.from("workout_logs").select("*").eq("user_id", uid).order("log_date", { ascending: false }).limit(60),
      db.from("progress_entries").select("*").eq("user_id", uid).order("entry_date", { ascending: false }),
      db
        .from("advice_requests")
        .select("*, advice_replies(id, message, created_at)")
        .eq("user_id", uid)
        .order("created_at", { ascending: false }),
    ]);

    const firstError = [
      memberships,
      plans,
      payments,
      attendance,
      memberPlans,
      workouts,
      diets,
      workoutDays,
      meals,
      exercises,
      logs,
      progress,
      requests,
    ].find((r) => r.error);

    return {
      data: {
        memberships: (memberships.data ?? []) as Membership[],
        plans: (plans.data ?? []) as MembershipPlan[],
        payments: (payments.data ?? []) as Payment[],
        attendance: (attendance.data ?? []) as Attendance[],
        memberPlans: (memberPlans.data ?? []) as MemberPlan[],
        workouts: (workouts.data ?? []) as WorkoutTemplate[],
        diets: (diets.data ?? []) as DietTemplate[],
        workoutDays: (workoutDays.data ?? []) as DayWithItems[],
        meals: (meals.data ?? []) as DietMeal[],
        exercises: (exercises.data ?? []) as Exercise[],
        logs: (logs.data ?? []) as WorkoutLog[],
        progress: (progress.data ?? []) as ProgressEntry[],
        requests: (requests.data ?? []) as CustomerData["requests"],
      },
      error: firstError?.error ? { message: firstError.error.message } : null,
    };
  }, [uid]);

  if (loading || !data) return <Loading />;

  const activeMembership = data.memberships.find((m) => m.status === "active" && m.end_date >= today());
  const activePlan = data.memberPlans.find((p) => p.active);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Member area</p>
        <h1 className="mt-2 font-display text-5xl font-black uppercase leading-none sm:text-6xl">
          {profile?.full_name ? `Hey, ${profile.full_name.split(" ")[0]}.` : "Your floor."}
        </h1>
      </div>
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab === "home" && (
        <Home
          d={data}
          activeMembership={activeMembership}
          activePlan={activePlan}
          onGo={setTab}
        />
      )}
      {tab === "profile" && <ProfileTab reload={reload} refreshProfile={refreshProfile} />}
      {tab === "membership" && (
        <MembershipTab d={data} activeMembership={activeMembership} />
      )}
      {tab === "workout" && (
        <WorkoutTab d={data} uid={uid} activePlan={activePlan} reload={reload} />
      )}
      {tab === "diet" && <DietTab d={data} uid={uid} activePlan={activePlan} reload={reload} />}
      {tab === "library" && <LibraryTab d={data} />}
      {tab === "checkin" && <CheckInTab d={data} uid={uid} reload={reload} />}
      {tab === "progress" && <ProgressTab d={data} uid={uid} reload={reload} />}
      {tab === "trainer" && <TrainerTab d={data} uid={uid} reload={reload} />}
    </div>
  );
}

function Home({
  d,
  activeMembership,
  activePlan,
  onGo,
}: {
  d: CustomerData;
  activeMembership?: Membership | undefined;
  activePlan?: MemberPlan | undefined;
  onGo: (id: TabId) => void;
}) {
  const planName = activeMembership
    ? d.plans.find((p) => p.id === activeMembership.plan_id)?.name ?? "Membership"
    : null;
  const checkedIn = d.attendance.some((a) => a.attended_on === today());
  const workoutName = activePlan?.workout_template_id
    ? d.workouts.find((w) => w.id === activePlan.workout_template_id)?.name
    : null;
  const dietName = activePlan?.diet_template_id
    ? d.diets.find((x) => x.id === activePlan.diet_template_id)?.name
    : null;
  const latest = d.progress[0];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Membership"
          value={activeMembership ? "Active" : "None"}
          hint={activeMembership ? `Ends ${fmtDate(activeMembership.end_date)}` : "Ask the desk to assign a plan"}
        />
        <Stat
          label="Today"
          value={checkedIn ? "Checked in" : "Not yet"}
          hint={checkedIn ? "You're on the floor" : "Check in when you arrive"}
        />
        <Stat
          label="Workout plan"
          value={workoutName ? "Assigned" : "Pick one"}
          hint={workoutName ?? "Choose a template in Workout"}
        />
        <Stat
          label="Latest weight"
          value={latest?.weight_kg ? `${latest.weight_kg} kg` : "—"}
          hint={latest ? fmtDate(latest.entry_date) : "Log progress anytime"}
        />
      </div>
      <Panel title="Quick actions">
        <div className="flex flex-wrap gap-3">
          <Button variant="copper" size="editorial" onClick={() => onGo("checkin")}>
            Check in
          </Button>
          <Button variant="copperOutline" size="editorial" onClick={() => onGo("workout")}>
            Open workout
          </Button>
          <Button variant="copperOutline" size="editorial" onClick={() => onGo("diet")}>
            Open diet
          </Button>
          <Button variant="copperOutline" size="editorial" onClick={() => onGo("trainer")}>
            Ask trainer
          </Button>
        </div>
        {(planName || dietName) && (
          <p className="mt-5 text-sm text-muted-foreground">
            {planName && (
              <>
                Plan: <span className="text-foreground">{planName}</span>
              </>
            )}
            {planName && dietName && " · "}
            {dietName && (
              <>
                Diet: <span className="text-foreground">{dietName}</span>
              </>
            )}
          </p>
        )}
      </Panel>
      <Disclaimer>
        Workout and diet plans are general training guidance, not medical advice. Speak with a
        qualified professional before starting any new programme.
      </Disclaimer>
    </div>
  );
}

function ProfileTab({
  reload,
  refreshProfile,
}: {
  reload: () => void;
  refreshProfile: () => Promise<void>;
}) {
  const { user, profile } = useAuth();

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    try {
      const { error } = await db
        .from("profiles")
        .update({
          full_name: String(f.get("full_name") || "") || null,
          phone: String(f.get("phone") || "") || null,
          goal: String(f.get("goal") || "") || null,
          experience_level: String(f.get("experience_level") || "") || null,
          workout_days: Number(f.get("workout_days")) || null,
          diet_preference: String(f.get("diet_preference") || "") || null,
          height_cm: Number(f.get("height_cm")) || null,
          starting_weight_kg: Number(f.get("starting_weight_kg")) || null,
          notes: String(f.get("notes") || "") || null,
        })
        .eq("id", user!.id);
      if (error) throw error;
      await refreshProfile();
      reload();
      toast.success("Profile updated.");
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <Panel title="Your profile">
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Full name">
          <input name="full_name" defaultValue={profile?.full_name ?? ""} className={inputClass} />
        </Field>
        <Field label="Phone">
          <input name="phone" defaultValue={profile?.phone ?? ""} className={inputClass} />
        </Field>
        <Field label="Goal">
          <select name="goal" defaultValue={profile?.goal ?? ""} className={inputClass}>
            <option value="">Select</option>
            {GOALS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Experience">
          <select name="experience_level" defaultValue={profile?.experience_level ?? ""} className={inputClass}>
            <option value="">Select</option>
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Training days / week">
          <select name="workout_days" defaultValue={profile?.workout_days ?? 4} className={inputClass}>
            {[3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Diet preference">
          <select name="diet_preference" defaultValue={profile?.diet_preference ?? ""} className={inputClass}>
            <option value="">Select</option>
            {DIETS.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Height (cm)">
          <input
            name="height_cm"
            type="number"
            min={0}
            step="0.1"
            defaultValue={profile?.height_cm ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Starting weight (kg)">
          <input
            name="starting_weight_kg"
            type="number"
            min={0}
            step="0.1"
            defaultValue={profile?.starting_weight_kg ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Notes">
          <input name="notes" defaultValue={profile?.notes ?? ""} className={inputClass} placeholder="Injuries, preferences…" />
        </Field>
        <div className="flex items-end sm:col-span-2 lg:col-span-3">
          <Button type="submit" variant="copper" size="editorial">
            Save profile
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function MembershipTab({
  d,
  activeMembership,
}: {
  d: CustomerData;
  activeMembership?: Membership | undefined;
}) {
  const plan = activeMembership
    ? d.plans.find((p) => p.id === activeMembership.plan_id)
    : undefined;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Status" value={activeMembership ? "Active" : "Inactive"} />
        <Stat label="Plan" value={plan?.name ?? "—"} {...(plan ? { hint: inr(plan.price) } : {})} />
        <Stat
          label="Valid until"
          value={activeMembership ? fmtDate(activeMembership.end_date) : "—"}
          hint={
            activeMembership
              ? `Started ${fmtDate(activeMembership.start_date)}`
              : "Membership is assigned by the gym"
          }
        />
      </div>
      <Panel title="Membership history">
        {d.memberships.length === 0 ? (
          <Empty text="No membership on file yet. Visit the desk or WhatsApp the gym to join." />
        ) : (
          <Table head={["Plan", "Start", "End", "Status"]}>
            {d.memberships.map((m) => {
              const p = d.plans.find((x) => x.id === m.plan_id);
              const live = m.status === "active" && m.end_date >= today();
              return (
                <tr key={m.id} className="border-b border-border/60">
                  <td className="py-3 pr-4 font-semibold">{p?.name ?? "—"}</td>
                  <td className="py-3 pr-4">{fmtDate(m.start_date)}</td>
                  <td className="py-3 pr-4">{fmtDate(m.end_date)}</td>
                  <td className={`py-3 pr-4 ${live ? "text-primary" : "text-muted-foreground"}`}>
                    {live ? "Active" : m.status}
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Panel>
      <Panel title="Fee history">
        {d.payments.length === 0 ? (
          <Empty text="No fee payments recorded yet." />
        ) : (
          <Table head={["Date", "Amount", "Method", "Note"]}>
            {d.payments.map((p) => (
              <tr key={p.id} className="border-b border-border/60">
                <td className="py-3 pr-4">{fmtDate(p.paid_on)}</td>
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

async function activatePlan(
  uid: string,
  patch: { workout_template_id?: string | null; diet_template_id?: string | null },
  current?: MemberPlan,
) {
  if (current) {
    const { error } = await db
      .from("member_plans")
      .update({
        ...patch,
        active: true,
        started_on: today(),
      })
      .eq("id", current.id);
    if (error) throw error;
    return;
  }
  const { error } = await db.from("member_plans").insert({
    user_id: uid,
    workout_template_id: patch.workout_template_id ?? null,
    diet_template_id: patch.diet_template_id ?? null,
    started_on: today(),
    active: true,
  });
  if (error) throw error;
}

function WorkoutTab({
  d,
  uid,
  activePlan,
  reload,
}: {
  d: CustomerData;
  uid: string;
  activePlan?: MemberPlan | undefined;
  reload: () => void;
}) {
  const { profile } = useAuth();
  const templateId = activePlan?.workout_template_id ?? null;
  const template = d.workouts.find((w) => w.id === templateId);
  const days = useMemo(
    () => d.workoutDays.filter((day) => day.template_id === templateId).sort((a, b) => a.day_number - b.day_number),
    [d.workoutDays, templateId],
  );

  const suggested = d.workouts.filter((w) => {
    if (profile?.goal && w.goal !== profile.goal) return false;
    if (profile?.experience_level && w.experience_level !== profile.experience_level) return false;
    return true;
  });
  const list = suggested.length ? suggested : d.workouts;

  const pick = async (id: string) => {
    try {
      await activatePlan(uid, { workout_template_id: id }, activePlan);
      toast.success("Workout plan activated.");
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const logDay = async (dayNumber: number) => {
    try {
      const { error } = await db.from("workout_logs").upsert(
        {
          user_id: uid,
          log_date: today(),
          day_number: dayNumber,
          template_id: templateId,
          notes: null,
        },
        { onConflict: "user_id,log_date,day_number" },
      );
      if (error) throw error;
      toast.success(`Day ${dayNumber} logged.`);
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="space-y-6">
      <Disclaimer>
        Follow good form, warm up properly, and stop if you feel pain. These plans are starter
        frameworks — adjust with a coach when needed.
      </Disclaimer>

      {template ? (
        <Panel
          title={template.name}
          action={
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {labelOf(GOALS, template.goal)} · {labelOf(LEVELS, template.experience_level)} ·{" "}
              {template.days_per_week} days
            </span>
          }
        >
          {template.description && (
            <p className="mb-5 text-sm text-muted-foreground">{template.description}</p>
          )}
          {days.length === 0 ? (
            <Empty text="This template has no day breakdown yet. Ask the gym to flesh it out." />
          ) : (
            <div className="space-y-6">
              {days.map((day) => {
                const doneToday = d.logs.some(
                  (l) => l.log_date === today() && l.day_number === day.day_number && l.template_id === templateId,
                );
                const items = [...(day.workout_template_items ?? [])].sort((a, b) => a.position - b.position);
                return (
                  <div key={day.id} className="border-t border-border pt-5 first:border-t-0 first:pt-0">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <h4 className="font-display text-2xl font-bold uppercase">
                        Day {day.day_number} — {day.title}
                      </h4>
                      <Button
                        variant={doneToday ? "copperOutline" : "copper"}
                        size="sm"
                        onClick={() => logDay(day.day_number)}
                        disabled={doneToday}
                      >
                        {doneToday ? "Logged today" : "Mark done"}
                      </Button>
                    </div>
                    {items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No exercises listed for this day.</p>
                    ) : (
                      <Table head={["Exercise", "Sets", "Reps", "Rest"]}>
                        {items.map((item) => (
                          <tr key={item.id} className="border-b border-border/60">
                            <td className="py-3 pr-4 font-semibold">
                              {item.exercises?.name ?? "Exercise"}
                              {item.exercises?.muscle_group && (
                                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                                  {item.exercises.muscle_group}
                                </span>
                              )}
                            </td>
                            <td className="py-3 pr-4">{item.sets}</td>
                            <td className="py-3 pr-4">{item.reps}</td>
                            <td className="py-3 pr-4">{item.rest_seconds}s</td>
                          </tr>
                        ))}
                      </Table>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      ) : (
        <Panel title="Choose a workout plan">
          <Empty text="Activate a template below to open your weekly planner." />
        </Panel>
      )}

      <Panel title={template ? "Switch plan" : "Available plans"}>
        {list.length === 0 ? (
          <Empty text="No workout templates yet." />
        ) : (
          <div className="space-y-3">
            {list.map((w) => (
              <div
                key={w.id}
                className="flex flex-col gap-3 border-b border-border/60 pb-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">{w.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {labelOf(GOALS, w.goal)} · {labelOf(LEVELS, w.experience_level)} · {w.days_per_week}{" "}
                    days/week
                  </p>
                </div>
                <Button
                  variant={w.id === templateId ? "copperOutline" : "copper"}
                  size="sm"
                  disabled={w.id === templateId}
                  onClick={() => pick(w.id)}
                >
                  {w.id === templateId ? "Active" : "Activate"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Recent workout logs">
        {d.logs.length === 0 ? (
          <Empty text="No sessions logged yet." />
        ) : (
          <Table head={["Date", "Day", "Plan"]}>
            {d.logs.slice(0, 12).map((l) => (
              <tr key={l.id} className="border-b border-border/60">
                <td className="py-3 pr-4">{fmtDate(l.log_date)}</td>
                <td className="py-3 pr-4">Day {l.day_number}</td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {d.workouts.find((w) => w.id === l.template_id)?.name ?? "—"}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}

function DietTab({
  d,
  uid,
  activePlan,
  reload,
}: {
  d: CustomerData;
  uid: string;
  activePlan?: MemberPlan | undefined;
  reload: () => void;
}) {
  const { profile } = useAuth();
  const templateId = activePlan?.diet_template_id ?? null;
  const template = d.diets.find((x) => x.id === templateId);
  const meals = useMemo(
    () => d.meals.filter((m) => m.template_id === templateId).sort((a, b) => a.position - b.position),
    [d.meals, templateId],
  );

  const suggested = d.diets.filter((x) => {
    if (profile?.goal && x.goal !== profile.goal) return false;
    if (profile?.diet_preference && x.diet_preference !== profile.diet_preference) return false;
    return true;
  });
  const list = suggested.length ? suggested : d.diets;

  const pick = async (id: string) => {
    try {
      await activatePlan(uid, { diet_template_id: id }, activePlan);
      toast.success("Diet plan activated.");
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="space-y-6">
      <Disclaimer>
        Meal plans are illustrative guidance only. Adjust portions to your needs and consult a
        nutrition professional for personalised advice.
      </Disclaimer>

      {template ? (
        <Panel
          title={template.name}
          action={
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {labelOf(GOALS, template.goal)} · {labelOf(DIETS, template.diet_preference)}
              {template.calories ? ` · ${template.calories} kcal` : ""}
            </span>
          }
        >
          {template.description && (
            <p className="mb-5 text-sm text-muted-foreground">{template.description}</p>
          )}
          {meals.length === 0 ? (
            <Empty text="This diet template has no meals listed yet." />
          ) : (
            <div className="space-y-4">
              {meals.map((m) => (
                <div key={m.id} className="border-b border-border/60 pb-4 last:border-0 last:pb-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                    {m.meal_time}
                  </p>
                  <h4 className="mt-1 font-display text-xl font-bold uppercase">{m.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{m.items}</p>
                  {m.calories != null && (
                    <p className="mt-2 text-xs text-muted-foreground">~{m.calories} kcal</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      ) : (
        <Panel title="Choose a diet plan">
          <Empty text="Activate a template below to see your daily meals." />
        </Panel>
      )}

      <Panel title={template ? "Switch diet" : "Available diets"}>
        {list.length === 0 ? (
          <Empty text="No diet templates yet." />
        ) : (
          <div className="space-y-3">
            {list.map((x) => (
              <div
                key={x.id}
                className="flex flex-col gap-3 border-b border-border/60 pb-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">{x.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {labelOf(GOALS, x.goal)} · {labelOf(DIETS, x.diet_preference)}
                    {x.calories ? ` · ${x.calories} kcal` : ""}
                  </p>
                </div>
                <Button
                  variant={x.id === templateId ? "copperOutline" : "copper"}
                  size="sm"
                  disabled={x.id === templateId}
                  onClick={() => pick(x.id)}
                >
                  {x.id === templateId ? "Active" : "Activate"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function LibraryTab({ d }: { d: CustomerData }) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("all");

  const groups = useMemo(
    () => ["all", ...Array.from(new Set(d.exercises.map((e) => e.muscle_group))).sort()],
    [d.exercises],
  );

  const rows = d.exercises.filter((e) => {
    if (group !== "all" && e.muscle_group !== group) return false;
    const hay = `${e.name} ${e.equipment ?? ""} ${e.muscle_group}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <Panel
      title={`Exercise library (${rows.length})`}
      action={
        <div className="flex flex-wrap gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className={inputClass + " max-w-40"}
          />
          <select value={group} onChange={(e) => setGroup(e.target.value)} className={inputClass + " max-w-44"}>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g === "all" ? "All groups" : g}
              </option>
            ))}
          </select>
        </div>
      }
    >
      {rows.length === 0 ? (
        <Empty text="No exercises match your filters." />
      ) : (
        <Table head={["Exercise", "Muscle", "Equipment", "Level", "Notes"]}>
          {rows.map((e) => (
            <tr key={e.id} className="border-b border-border/60 align-top">
              <td className="py-3 pr-4 font-semibold">{e.name}</td>
              <td className="py-3 pr-4">{e.muscle_group}</td>
              <td className="py-3 pr-4">{e.equipment ?? "—"}</td>
              <td className="py-3 pr-4 capitalize">{e.difficulty ?? "—"}</td>
              <td className="py-3 pr-4 text-muted-foreground">{e.instructions ?? "—"}</td>
            </tr>
          ))}
        </Table>
      )}
    </Panel>
  );
}

function CheckInTab({ d, uid, reload }: { d: CustomerData; uid: string; reload: () => void }) {
  const checkedIn = d.attendance.some((a) => a.attended_on === today());
  const monthCount = d.attendance.filter((a) => a.attended_on.startsWith(today().slice(0, 7))).length;

  const checkIn = async () => {
    try {
      const { error } = await db.from("attendance").insert({
        user_id: uid,
        attended_on: today(),
        source: "self",
      });
      if (error) throw error;
      toast.success("Checked in for today.");
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Today" value={checkedIn ? "Present" : "Absent"} />
        <Stat label="This month" value={String(monthCount)} hint="Self check-ins" />
        <Stat label="Total logged" value={String(d.attendance.length)} />
      </div>
      <Panel title="Floor check-in">
        <p className="mb-5 max-w-lg text-sm leading-6 text-muted-foreground">
          Tap once when you arrive at Evolution Fitness. One check-in per day.
        </p>
        <Button variant="copper" size="editorial" disabled={checkedIn} onClick={checkIn}>
          {checkedIn ? "Already checked in" : "Check in now"}
        </Button>
      </Panel>
      <Panel title="Recent attendance">
        {d.attendance.length === 0 ? (
          <Empty text="No check-ins yet." />
        ) : (
          <Table head={["Date", "Source"]}>
            {d.attendance.slice(0, 30).map((a) => (
              <tr key={a.id} className="border-b border-border/60">
                <td className="py-3 pr-4">{fmtDate(a.attended_on)}</td>
                <td className="py-3 pr-4 capitalize text-muted-foreground">{a.source ?? "self"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}

function ProgressTab({ d, uid, reload }: { d: CustomerData; uid: string; reload: () => void }) {
  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    try {
      const { error } = await db.from("progress_entries").insert({
        user_id: uid,
        entry_date: String(f.get("entry_date") || today()),
        weight_kg: Number(f.get("weight_kg")) || null,
        body_fat: Number(f.get("body_fat")) || null,
        chest_cm: Number(f.get("chest_cm")) || null,
        waist_cm: Number(f.get("waist_cm")) || null,
        arms_cm: Number(f.get("arms_cm")) || null,
        note: String(f.get("note") || "") || null,
      });
      if (error) throw error;
      form.reset();
      toast.success("Progress saved.");
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const latest = d.progress[0];
  const first = d.progress[d.progress.length - 1];
  const delta =
    latest?.weight_kg != null && first?.weight_kg != null
      ? Number(latest.weight_kg) - Number(first.weight_kg)
      : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Current weight"
          value={latest?.weight_kg != null ? `${latest.weight_kg} kg` : "—"}
          {...(latest ? { hint: fmtDate(latest.entry_date) } : {})}
        />
        <Stat
          label="Waist"
          value={latest?.waist_cm != null ? `${latest.waist_cm} cm` : "—"}
        />
        <Stat
          label="Change since start"
          value={delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)} kg`}
          {...(first ? { hint: `From ${fmtDate(first.entry_date)}` } : {})}
        />
      </div>
      <Panel title="Log progress">
        <form onSubmit={add} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Date">
            <input type="date" name="entry_date" defaultValue={today()} className={inputClass} />
          </Field>
          <Field label="Weight (kg)">
            <input name="weight_kg" type="number" step="0.1" min={0} className={inputClass} />
          </Field>
          <Field label="Body fat %">
            <input name="body_fat" type="number" step="0.1" min={0} className={inputClass} />
          </Field>
          <Field label="Chest (cm)">
            <input name="chest_cm" type="number" step="0.1" min={0} className={inputClass} />
          </Field>
          <Field label="Waist (cm)">
            <input name="waist_cm" type="number" step="0.1" min={0} className={inputClass} />
          </Field>
          <Field label="Arms (cm)">
            <input name="arms_cm" type="number" step="0.1" min={0} className={inputClass} />
          </Field>
          <Field label="Note">
            <input name="note" className={inputClass} placeholder="Optional" />
          </Field>
          <div className="flex items-end">
            <Button type="submit" variant="copper" size="editorial" className="w-full">
              Save entry
            </Button>
          </div>
        </form>
      </Panel>
      <Panel title="History">
        {d.progress.length === 0 ? (
          <Empty text="No progress entries yet." />
        ) : (
          <Table head={["Date", "Weight", "Waist", "Chest", "Arms", "Note"]}>
            {d.progress.map((p) => (
              <tr key={p.id} className="border-b border-border/60">
                <td className="py-3 pr-4">{fmtDate(p.entry_date)}</td>
                <td className="py-3 pr-4">{p.weight_kg != null ? `${p.weight_kg} kg` : "—"}</td>
                <td className="py-3 pr-4">{p.waist_cm != null ? `${p.waist_cm}` : "—"}</td>
                <td className="py-3 pr-4">{p.chest_cm != null ? `${p.chest_cm}` : "—"}</td>
                <td className="py-3 pr-4">{p.arms_cm != null ? `${p.arms_cm}` : "—"}</td>
                <td className="py-3 pr-4 text-muted-foreground">{p.note ?? "—"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}

function TrainerTab({ d, uid, reload }: { d: CustomerData; uid: string; reload: () => void }) {
  const ask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    try {
      const { error } = await db.from("advice_requests").insert({
        user_id: uid,
        subject: String(f.get("subject")),
        message: String(f.get("message")),
        status: "open",
      });
      if (error) throw error;
      form.reset();
      toast.success("Question sent to the trainer.");
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="space-y-6">
      <Panel title="Ask the trainer">
        <form onSubmit={ask} className="space-y-4">
          <Field label="Subject">
            <input name="subject" required className={inputClass} placeholder="Form check, diet tweak…" />
          </Field>
          <Field label="Message">
            <textarea
              name="message"
              required
              rows={4}
              className={inputClass + " h-auto py-3"}
              placeholder="Describe what you need help with"
            />
          </Field>
          <Button type="submit" variant="copper" size="editorial">
            Send request
          </Button>
        </form>
      </Panel>
      <Panel title="Your requests">
        {d.requests.length === 0 ? (
          <Empty text="No questions yet. Ask anything about training or diet." />
        ) : (
          <div className="space-y-4">
            {d.requests.map((r) => (
              <div key={r.id} className="border-b border-border/60 pb-4 last:border-0 last:pb-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                  {fmtDate(r.created_at)} · {r.status}
                </p>
                <h4 className="mt-1 font-display text-xl font-bold uppercase">{r.subject}</h4>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{r.message}</p>
                {r.advice_replies?.map((rep) => (
                  <p key={rep.id} className="mt-3 border-l-2 border-primary/60 pl-4 text-sm leading-6">
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                      Trainer · {fmtDate(rep.created_at)}
                    </span>
                    <span className="mt-1 block text-foreground">{rep.message}</span>
                  </p>
                ))}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
