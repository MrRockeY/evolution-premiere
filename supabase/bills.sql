-- ============================================================
-- BILLS — run this once in Supabase SQL Editor
-- Evolution Fitness owner billing for members + walk-ins
-- ============================================================

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  bill_number text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  guest_name text,
  guest_phone text,
  category text not null default 'membership',
  -- membership | personal_training | day_pass | merchandise | other
  title text not null,
  description text,
  amount numeric not null check (amount >= 0),
  status text not null default 'draft',
  -- draft | sent | paid | cancelled
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

-- Safe if bills table already exists from an earlier run
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

create index if not exists bills_user_id_idx on public.bills (user_id);
create index if not exists bills_status_idx on public.bills (status);
create index if not exists bills_billed_on_idx on public.bills (billed_on desc);
