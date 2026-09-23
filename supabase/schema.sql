-- ============================================================
-- EVOLUTION OS — full database schema for Supabase
-- Run this once in: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- ---------- ROLES ----------
do $$ begin
  create type public.app_role as enum ('owner', 'customer');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

drop policy if exists "read own roles" on public.user_roles;
create policy "read own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'owner'));

-- ---------- PROFILES ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  goal text,                 -- fat_loss | muscle_gain | strength | general_fitness
  experience_level text,     -- beginner | intermediate | advanced
  workout_days int check (workout_days between 3 and 6),
  diet_preference text,      -- vegetarian | non_vegetarian | eggetarian | vegan
  height_cm numeric,
  starting_weight_kg numeric,
  notes text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'owner'));
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles for insert to authenticated
  with check (id = auth.uid());
drop policy if exists "profiles update" on public.profiles;
create policy "profiles update" on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'owner'))
  with check (id = auth.uid() or public.has_role(auth.uid(), 'owner'));

-- auto-create profile + default customer role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'phone')
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'customer')
  on conflict (user_id, role) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- MEMBERSHIPS / FEES / EXPENSES ----------
create table if not exists public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  months int not null,
  price numeric not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.membership_plans to authenticated, anon;
grant insert, update, delete on public.membership_plans to authenticated;
grant all on public.membership_plans to service_role;
alter table public.membership_plans enable row level security;
drop policy if exists "plans readable" on public.membership_plans;
create policy "plans readable" on public.membership_plans for select using (true);
drop policy if exists "plans owner write" on public.membership_plans;
create policy "plans owner write" on public.membership_plans for all to authenticated
  using (public.has_role(auth.uid(), 'owner')) with check (public.has_role(auth.uid(), 'owner'));

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  plan_id uuid references public.membership_plans(id) on delete set null,
  start_date date not null default current_date,
  end_date date not null,
  status text not null default 'active',  -- active | expired | paused
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.memberships to authenticated;
grant all on public.memberships to service_role;
alter table public.memberships enable row level security;
drop policy if exists "memberships read" on public.memberships;
create policy "memberships read" on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'owner'));
drop policy if exists "memberships owner write" on public.memberships;
create policy "memberships owner write" on public.memberships for all to authenticated
  using (public.has_role(auth.uid(), 'owner')) with check (public.has_role(auth.uid(), 'owner'));

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  membership_id uuid references public.memberships(id) on delete set null,
  amount numeric not null,
  paid_on date not null default current_date,
  method text not null default 'cash',  -- cash | upi | card | bank
  note text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
drop policy if exists "payments read" on public.payments;
create policy "payments read" on public.payments for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'owner'));
drop policy if exists "payments owner write" on public.payments;
create policy "payments owner write" on public.payments for all to authenticated
  using (public.has_role(auth.uid(), 'owner')) with check (public.has_role(auth.uid(), 'owner'));

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  amount numeric not null,
  spent_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;
alter table public.expenses enable row level security;
drop policy if exists "expenses owner only" on public.expenses;
create policy "expenses owner only" on public.expenses for all to authenticated
  using (public.has_role(auth.uid(), 'owner')) with check (public.has_role(auth.uid(), 'owner'));

-- ---------- ATTENDANCE ----------
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  attended_on date not null default current_date,
  source text not null default 'self',
  created_at timestamptz not null default now(),
  unique (user_id, attended_on)
);
grant select, insert, delete on public.attendance to authenticated;
grant all on public.attendance to service_role;
alter table public.attendance enable row level security;
drop policy if exists "attendance read" on public.attendance;
create policy "attendance read" on public.attendance for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'owner'));
drop policy if exists "attendance insert" on public.attendance;
create policy "attendance insert" on public.attendance for insert to authenticated
  with check (user_id = auth.uid() or public.has_role(auth.uid(), 'owner'));
drop policy if exists "attendance delete" on public.attendance;
create policy "attendance delete" on public.attendance for delete to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'owner'));

-- ---------- EXERCISE LIBRARY & TEMPLATES ----------
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  muscle_group text not null,
  equipment text,
  difficulty text,
  instructions text,
  created_at timestamptz not null default now()
);
create table if not exists public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  goal text not null,
  experience_level text not null,
  days_per_week int not null,
  description text,
  created_at timestamptz not null default now()
);
create table if not exists public.workout_template_days (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.workout_templates(id) on delete cascade not null,
  day_number int not null,
  title text not null
);
create table if not exists public.workout_template_items (
  id uuid primary key default gen_random_uuid(),
  day_id uuid references public.workout_template_days(id) on delete cascade not null,
  exercise_id uuid references public.exercises(id) on delete cascade not null,
  sets int not null default 3,
  reps text not null default '10-12',
  rest_seconds int not null default 60,
  position int not null default 1
);
create table if not exists public.diet_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  goal text not null,
  diet_preference text not null,
  calories int,
  description text,
  created_at timestamptz not null default now()
);
create table if not exists public.diet_template_meals (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.diet_templates(id) on delete cascade not null,
  meal_time text not null,
  title text not null,
  items text not null,
  calories int,
  position int not null default 1
);

do $$
declare t text;
begin
  foreach t in array array['exercises','workout_templates','workout_template_days','workout_template_items','diet_templates','diet_template_meals']
  loop
    execute format('grant select on public.%I to authenticated, anon', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "library read" on public.%I', t);
    execute format('create policy "library read" on public.%I for select using (true)', t);
    execute format('drop policy if exists "library owner write" on public.%I', t);
    execute format($p$create policy "library owner write" on public.%I for all to authenticated
      using (public.has_role(auth.uid(), 'owner')) with check (public.has_role(auth.uid(), 'owner'))$p$, t);
  end loop;
end $$;

-- ---------- MEMBER PLANS / LOGS / PROGRESS ----------
create table if not exists public.member_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  workout_template_id uuid references public.workout_templates(id) on delete set null,
  diet_template_id uuid references public.diet_templates(id) on delete set null,
  started_on date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  log_date date not null default current_date,
  day_number int not null,
  template_id uuid references public.workout_templates(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, log_date, day_number)
);
create table if not exists public.progress_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  entry_date date not null default current_date,
  weight_kg numeric,
  body_fat numeric,
  chest_cm numeric,
  waist_cm numeric,
  arms_cm numeric,
  note text,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['member_plans','workout_logs','progress_entries']
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own read" on public.%I', t);
    execute format($p$create policy "own read" on public.%I for select to authenticated
      using (user_id = auth.uid() or public.has_role(auth.uid(), 'owner'))$p$, t);
    execute format('drop policy if exists "own write" on public.%I', t);
    execute format($p$create policy "own write" on public.%I for all to authenticated
      using (user_id = auth.uid() or public.has_role(auth.uid(), 'owner'))
      with check (user_id = auth.uid() or public.has_role(auth.uid(), 'owner'))$p$, t);
  end loop;
end $$;

-- ---------- ASK TRAINER ----------
create table if not exists public.advice_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  subject text not null,
  message text not null,
  status text not null default 'open',  -- open | answered | closed
  created_at timestamptz not null default now()
);
create table if not exists public.advice_replies (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.advice_requests(id) on delete cascade not null,
  author_id uuid references auth.users(id) on delete cascade not null,
  message text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.advice_requests to authenticated;
grant select, insert on public.advice_replies to authenticated;
grant all on public.advice_requests, public.advice_replies to service_role;
alter table public.advice_requests enable row level security;
alter table public.advice_replies enable row level security;

drop policy if exists "requests read" on public.advice_requests;
create policy "requests read" on public.advice_requests for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'owner'));
drop policy if exists "requests insert own" on public.advice_requests;
create policy "requests insert own" on public.advice_requests for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "requests update" on public.advice_requests;
create policy "requests update" on public.advice_requests for update to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'owner'))
  with check (user_id = auth.uid() or public.has_role(auth.uid(), 'owner'));

drop policy if exists "replies read" on public.advice_replies;
create policy "replies read" on public.advice_replies for select to authenticated
  using (exists (select 1 from public.advice_requests r where r.id = request_id
    and (r.user_id = auth.uid() or public.has_role(auth.uid(), 'owner'))));
drop policy if exists "replies insert" on public.advice_replies;
create policy "replies insert" on public.advice_replies for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.advice_requests r
    where r.id = request_id and (r.user_id = auth.uid() or public.has_role(auth.uid(), 'owner'))));

-- ============================================================
-- DEMO / STARTER DATA (clearly marked, safe to delete)
-- ============================================================
insert into public.membership_plans (name, months, price)
select * from (values ('1 Month', 1, 1200), ('3 Months', 3, 3000), ('6 Months', 6, 5500), ('1 Year', 12, 9500)) v(name, months, price)
where not exists (select 1 from public.membership_plans);

insert into public.exercises (name, muscle_group, equipment, difficulty, instructions)
select * from (values
  ('Barbell Bench Press','Chest','Barbell','intermediate','Lower the bar to mid-chest with control, press up without locking harshly.'),
  ('Incline Dumbbell Press','Chest','Dumbbell','beginner','Bench at 30 degrees, press dumbbells up and slightly together.'),
  ('Lat Pulldown','Back','Machine','beginner','Pull the bar to upper chest, squeeze shoulder blades down.'),
  ('Barbell Row','Back','Barbell','intermediate','Hinge at hips, row the bar to the lower ribs.'),
  ('Overhead Press','Shoulders','Barbell','intermediate','Press overhead without leaning back excessively.'),
  ('Lateral Raise','Shoulders','Dumbbell','beginner','Raise to shoulder height with slight elbow bend.'),
  ('Barbell Squat','Legs','Barbell','intermediate','Sit down and back, keep chest tall, drive through mid-foot.'),
  ('Leg Press','Legs','Machine','beginner','Lower until knees reach 90 degrees, press without locking out.'),
  ('Romanian Deadlift','Legs','Barbell','intermediate','Hinge with soft knees, feel the hamstring stretch.'),
  ('Bicep Curl','Arms','Dumbbell','beginner','Curl without swinging the torso.'),
  ('Triceps Pushdown','Arms','Cable','beginner','Keep elbows pinned, extend fully.'),
  ('Plank','Core','Bodyweight','beginner','Hold a straight line from head to heels.'),
  ('Hanging Leg Raise','Core','Bodyweight','advanced','Raise legs with control, avoid swinging.'),
  ('Treadmill Intervals','Cardio','Machine','beginner','1 min fast / 2 min easy, repeat.'),
  ('Cycling','Cardio','Machine','beginner','Steady moderate pace.')
) v(name, muscle_group, equipment, difficulty, instructions)
where not exists (select 1 from public.exercises);

-- Demo workout templates (one per experience/goal combination shown in the app)
do $$
declare tpl uuid; d uuid;
begin
  if not exists (select 1 from public.workout_templates) then
    -- Fat loss / beginner / 3 days
    insert into public.workout_templates (name, goal, experience_level, days_per_week, description)
    values ('[DEMO] Fat Loss Foundations','fat_loss','beginner',3,'Full-body circuits with cardio finishers.') returning id into tpl;
    insert into public.workout_template_days (template_id, day_number, title) values (tpl,1,'Full Body A') returning id into d;
    insert into public.workout_template_items (day_id, exercise_id, sets, reps, position)
      select d, id, 3, '12', row_number() over () from public.exercises where name in ('Leg Press','Lat Pulldown','Incline Dumbbell Press','Plank','Treadmill Intervals');
    insert into public.workout_template_days (template_id, day_number, title) values (tpl,2,'Full Body B') returning id into d;
    insert into public.workout_template_items (day_id, exercise_id, sets, reps, position)
      select d, id, 3, '12', row_number() over () from public.exercises where name in ('Barbell Squat','Barbell Row','Lateral Raise','Cycling');
    insert into public.workout_template_days (template_id, day_number, title) values (tpl,3,'Full Body C') returning id into d;
    insert into public.workout_template_items (day_id, exercise_id, sets, reps, position)
      select d, id, 3, '12', row_number() over () from public.exercises where name in ('Romanian Deadlift','Bicep Curl','Triceps Pushdown','Treadmill Intervals');

    -- Muscle gain / intermediate / 4 days
    insert into public.workout_templates (name, goal, experience_level, days_per_week, description)
    values ('[DEMO] Hypertrophy Upper/Lower','muscle_gain','intermediate',4,'Upper/lower split for size.') returning id into tpl;
    insert into public.workout_template_days (template_id, day_number, title) values (tpl,1,'Upper Push') returning id into d;
    insert into public.workout_template_items (day_id, exercise_id, sets, reps, position)
      select d, id, 4, '8-10', row_number() over () from public.exercises where name in ('Barbell Bench Press','Overhead Press','Lateral Raise','Triceps Pushdown');
    insert into public.workout_template_days (template_id, day_number, title) values (tpl,2,'Lower A') returning id into d;
    insert into public.workout_template_items (day_id, exercise_id, sets, reps, position)
      select d, id, 4, '8-10', row_number() over () from public.exercises where name in ('Barbell Squat','Romanian Deadlift','Leg Press');
    insert into public.workout_template_days (template_id, day_number, title) values (tpl,3,'Upper Pull') returning id into d;
    insert into public.workout_template_items (day_id, exercise_id, sets, reps, position)
      select d, id, 4, '8-10', row_number() over () from public.exercises where name in ('Barbell Row','Lat Pulldown','Bicep Curl');
    insert into public.workout_template_days (template_id, day_number, title) values (tpl,4,'Lower B + Core') returning id into d;
    insert into public.workout_template_items (day_id, exercise_id, sets, reps, position)
      select d, id, 3, '10-12', row_number() over () from public.exercises where name in ('Leg Press','Hanging Leg Raise','Plank');

    -- Strength / advanced / 5 days
    insert into public.workout_templates (name, goal, experience_level, days_per_week, description)
    values ('[DEMO] Strength Block','strength','advanced',5,'Heavy compound focus with accessories.') returning id into tpl;
    insert into public.workout_template_days (template_id, day_number, title) values (tpl,1,'Squat Day') returning id into d;
    insert into public.workout_template_items (day_id, exercise_id, sets, reps, position)
      select d, id, 5, '5', row_number() over () from public.exercises where name in ('Barbell Squat','Leg Press','Plank');
    insert into public.workout_template_days (template_id, day_number, title) values (tpl,2,'Bench Day') returning id into d;
    insert into public.workout_template_items (day_id, exercise_id, sets, reps, position)
      select d, id, 5, '5', row_number() over () from public.exercises where name in ('Barbell Bench Press','Triceps Pushdown');
    insert into public.workout_template_days (template_id, day_number, title) values (tpl,3,'Pull Day') returning id into d;
    insert into public.workout_template_items (day_id, exercise_id, sets, reps, position)
      select d, id, 5, '5', row_number() over () from public.exercises where name in ('Barbell Row','Lat Pulldown','Bicep Curl');
    insert into public.workout_template_days (template_id, day_number, title) values (tpl,4,'Press Day') returning id into d;
    insert into public.workout_template_items (day_id, exercise_id, sets, reps, position)
      select d, id, 4, '6', row_number() over () from public.exercises where name in ('Overhead Press','Lateral Raise');
    insert into public.workout_template_days (template_id, day_number, title) values (tpl,5,'Posterior Chain') returning id into d;
    insert into public.workout_template_items (day_id, exercise_id, sets, reps, position)
      select d, id, 4, '6-8', row_number() over () from public.exercises where name in ('Romanian Deadlift','Hanging Leg Raise');

    -- General fitness / beginner / 6 days
    insert into public.workout_templates (name, goal, experience_level, days_per_week, description)
    values ('[DEMO] Daily Habit 6-Day','general_fitness','beginner',6,'Short focused sessions, six days a week.') returning id into tpl;
    insert into public.workout_template_days (template_id, day_number, title) values (tpl,1,'Push') returning id into d;
    insert into public.workout_template_items (day_id, exercise_id, sets, reps, position)
      select d, id, 3, '12', row_number() over () from public.exercises where name in ('Incline Dumbbell Press','Lateral Raise');
    insert into public.workout_template_days (template_id, day_number, title) values (tpl,2,'Pull') returning id into d;
    insert into public.workout_template_items (day_id, exercise_id, sets, reps, position)
      select d, id, 3, '12', row_number() over () from public.exercises where name in ('Lat Pulldown','Bicep Curl');
    insert into public.workout_template_days (template_id, day_number, title) values (tpl,3,'Legs') returning id into d;
    insert into public.workout_template_items (day_id, exercise_id, sets, reps, position)
      select d, id, 3, '12', row_number() over () from public.exercises where name in ('Leg Press','Romanian Deadlift');
    insert into public.workout_template_days (template_id, day_number, title) values (tpl,4,'Cardio') returning id into d;
    insert into public.workout_template_items (day_id, exercise_id, sets, reps, position)
      select d, id, 1, '20 min', row_number() over () from public.exercises where name in ('Treadmill Intervals');
    insert into public.workout_template_days (template_id, day_number, title) values (tpl,5,'Core') returning id into d;
    insert into public.workout_template_items (day_id, exercise_id, sets, reps, position)
      select d, id, 3, '30-45s', row_number() over () from public.exercises where name in ('Plank','Hanging Leg Raise');
    insert into public.workout_template_days (template_id, day_number, title) values (tpl,6,'Full Body') returning id into d;
    insert into public.workout_template_items (day_id, exercise_id, sets, reps, position)
      select d, id, 3, '12', row_number() over () from public.exercises where name in ('Barbell Squat','Barbell Row','Cycling');
  end if;
end $$;

do $$
declare tpl uuid;
begin
  if not exists (select 1 from public.diet_templates) then
    insert into public.diet_templates (name, goal, diet_preference, calories, description)
    values ('[DEMO] Vegetarian Fat Loss','fat_loss','vegetarian',1700,'High protein vegetarian plan.') returning id into tpl;
    insert into public.diet_template_meals (template_id, meal_time, title, items, calories, position) values
      (tpl,'Breakfast','Protein start','Oats with milk, 1 fruit, soaked almonds',400,1),
      (tpl,'Lunch','Balanced plate','2 roti, dal, paneer bhurji, salad',550,2),
      (tpl,'Snack','Light','Buttermilk / sprouts chaat',200,3),
      (tpl,'Dinner','Light protein','Vegetable curry, 1 roti, curd',450,4);

    insert into public.diet_templates (name, goal, diet_preference, calories, description)
    values ('[DEMO] Non-Veg Muscle Gain','muscle_gain','non_vegetarian',2800,'Calorie surplus with lean protein.') returning id into tpl;
    insert into public.diet_template_meals (template_id, meal_time, title, items, calories, position) values
      (tpl,'Breakfast','Big start','4 eggs, 3 toast, banana, milk',700,1),
      (tpl,'Lunch','Main meal','Rice, chicken curry, dal, salad',850,2),
      (tpl,'Snack','Pre-workout','Peanut butter sandwich, milk',450,3),
      (tpl,'Dinner','Recovery','Grilled chicken/fish, roti, vegetables',800,4);

    insert into public.diet_templates (name, goal, diet_preference, calories, description)
    values ('[DEMO] Eggetarian Maintenance','general_fitness','eggetarian',2100,'Balanced everyday eating.') returning id into tpl;
    insert into public.diet_template_meals (template_id, meal_time, title, items, calories, position) values
      (tpl,'Breakfast','Simple','Poha with eggs, tea',500,1),
      (tpl,'Lunch','Home plate','Rice, dal, sabzi, curd',700,2),
      (tpl,'Snack','Light','Fruit and nuts',300,3),
      (tpl,'Dinner','Light','2 roti, paneer/egg curry, salad',600,4);

    insert into public.diet_templates (name, goal, diet_preference, calories, description)
    values ('[DEMO] Vegan Strength','strength','vegan',2400,'Plant-based, protein focused.') returning id into tpl;
    insert into public.diet_template_meals (template_id, meal_time, title, items, calories, position) values
      (tpl,'Breakfast','Plant protein','Tofu scramble, oats, soy milk',600,1),
      (tpl,'Lunch','Legume plate','Rajma, rice, salad',750,2),
      (tpl,'Snack','Recovery','Peanut butter, banana, soy milk',450,3),
      (tpl,'Dinner','Light','Chana masala, roti, vegetables',600,4);
  end if;
end $$;

-- ============================================================
-- MAKE YOURSELF THE OWNER
-- 1) Sign up in the app with your email
-- 2) Run the statement below with that email
-- ============================================================
-- insert into public.user_roles (user_id, role)
-- select id, 'owner' from auth.users where email = 'you@example.com'
-- on conflict (user_id, role) do nothing;

-- ============================================================
-- BILLS (also in supabase/bills.sql — safe to re-run)
-- ============================================================
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  bill_number text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  guest_name text,
  guest_phone text,
  category text not null default 'membership',
  title text not null,
  description text,
  amount numeric not null check (amount >= 0),
  status text not null default 'draft',
  billed_on date not null default current_date,
  due_on date,
  paid_on date,
  payment_id uuid references public.payments(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  note text,
  whatsapp_sent_at timestamptz,
  sms_sent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.bills add column if not exists sms_sent_at timestamptz;
grant select, insert, update, delete on public.bills to authenticated;
grant all on public.bills to service_role;
alter table public.bills enable row level security;
drop policy if exists "bills read" on public.bills;
create policy "bills read" on public.bills for select to authenticated
  using (
    public.has_role(auth.uid(), 'owner')
    or (
      user_id is not null
      and user_id = auth.uid()
      and status in ('sent', 'paid')
    )
  );
drop policy if exists "bills owner write" on public.bills;
create policy "bills owner write" on public.bills for all to authenticated
  using (public.has_role(auth.uid(), 'owner'))
  with check (public.has_role(auth.uid(), 'owner'));

