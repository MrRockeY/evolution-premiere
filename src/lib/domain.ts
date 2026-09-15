export type Role = "owner" | "customer";

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  goal: string | null;
  experience_level: string | null;
  workout_days: number | null;
  diet_preference: string | null;
  height_cm: number | null;
  starting_weight_kg: number | null;
  notes: string | null;
  created_at?: string;
};

export type MembershipPlan = {
  id: string;
  name: string;
  months: number;
  price: number;
  active: boolean;
};

export type Membership = {
  id: string;
  user_id: string;
  plan_id: string | null;
  start_date: string;
  end_date: string;
  status: string;
};

export type Payment = {
  id: string;
  user_id: string;
  membership_id: string | null;
  amount: number;
  paid_on: string;
  method: string;
  note: string | null;
};

export type Expense = {
  id: string;
  category: string;
  amount: number;
  spent_on: string;
  note: string | null;
};

export type Attendance = { id: string; user_id: string; attended_on: string; source?: string };

export type Exercise = {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string | null;
  difficulty: string | null;
  instructions: string | null;
};

export type WorkoutTemplate = {
  id: string;
  name: string;
  goal: string;
  experience_level: string;
  days_per_week: number;
  description: string | null;
};

export type DietTemplate = {
  id: string;
  name: string;
  goal: string;
  diet_preference: string;
  calories: number | null;
  description: string | null;
};

export type DietMeal = {
  id: string;
  template_id: string;
  meal_time: string;
  title: string;
  items: string;
  calories: number | null;
  position: number;
};

export type ProgressEntry = {
  id: string;
  user_id: string;
  entry_date: string;
  weight_kg: number | null;
  body_fat: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  arms_cm: number | null;
  note: string | null;
};

export type AdviceRequest = {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
};

export type AdviceReply = {
  id: string;
  request_id: string;
  author_id: string;
  message: string;
  created_at: string;
};

export type MemberPlan = {
  id: string;
  user_id: string;
  workout_template_id: string | null;
  diet_template_id: string | null;
  started_on: string;
  active: boolean;
};

export type WorkoutLog = {
  id: string;
  user_id: string;
  log_date: string;
  day_number: number;
  template_id: string | null;
  notes: string | null;
};

export type WorkoutTemplateDay = {
  id: string;
  template_id: string;
  day_number: number;
  title: string;
};

export type WorkoutTemplateItem = {
  id: string;
  day_id: string;
  exercise_id: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  position: number;
};

export const GOALS = [
  { value: "fat_loss", label: "Fat loss" },
  { value: "muscle_gain", label: "Muscle gain" },
  { value: "strength", label: "Strength" },
  { value: "general_fitness", label: "General fitness" },
];

export const LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

export const DIETS = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "non_vegetarian", label: "Non-vegetarian" },
  { value: "eggetarian", label: "Eggetarian" },
  { value: "vegan", label: "Vegan" },
];

export const labelOf = (list: { value: string; label: string }[], value?: string | null) =>
  list.find((i) => i.value === value)?.label ?? "—";

export const inr = (n: number) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
