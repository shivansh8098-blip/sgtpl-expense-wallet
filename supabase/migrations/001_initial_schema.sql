create extension if not exists "pgcrypto";

create type public.employee_role as enum ('admin', 'employee');
create type public.expense_status as enum ('pending', 'approved', 'rejected');
create type public.payment_mode as enum ('Bank Transfer', 'UPI', 'Cash', 'Cheque', 'Other');

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  mobile text,
  role public.employee_role not null default 'employee',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  expense_category text not null,
  other_expense_text text,
  amount numeric(12, 2) not null check (amount > 0),
  expense_date date not null default current_date,
  notes text,
  photo_urls text[] not null default '{}',
  status public.expense_status not null default 'pending',
  location text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  rejection_reason text,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.advances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_mode public.payment_mode not null default 'Bank Transfer',
  proof_urls text[] not null default '{}',
  remarks text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employees
    where lower(email) = lower(auth.jwt() ->> 'email')
      and role = 'admin'
      and active = true
  );
$$;

create or replace function public.current_employee_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select id
  from public.employees
  where lower(email) = lower(auth.jwt() ->> 'email')
    and active = true
  limit 1;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger expenses_touch_updated_at
before update on public.expenses
for each row execute function public.touch_updated_at();

create or replace function public.set_expense_audit_timestamps()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    new.approved_at = now();
  end if;

  if new.status = 'rejected' and old.status is distinct from 'rejected' then
    new.rejected_at = now();
  end if;

  return new;
end;
$$;

create trigger expenses_set_audit_timestamps
before update on public.expenses
for each row execute function public.set_expense_audit_timestamps();

alter table public.employees enable row level security;
alter table public.expenses enable row level security;
alter table public.advances enable row level security;

create policy "Employees can read themselves and admins can read all"
on public.employees for select
using (public.is_admin() or id = public.current_employee_id());

create policy "Admins can manage employees"
on public.employees for all
using (public.is_admin())
with check (public.is_admin());

create policy "Employees read own expenses and admins read all"
on public.expenses for select
using (public.is_admin() or employee_id = public.current_employee_id());

create policy "Employees insert own pending expenses"
on public.expenses for insert
with check (
  employee_id = public.current_employee_id()
  and status = 'pending'
);

create policy "Admins update expenses"
on public.expenses for update
using (public.is_admin())
with check (public.is_admin());

create policy "Admins delete expenses"
on public.expenses for delete
using (public.is_admin());

create policy "Employees read own advances and admins read all"
on public.advances for select
using (public.is_admin() or employee_id = public.current_employee_id());

create policy "Admins manage advances"
on public.advances for all
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('expense-bills', 'expense-bills', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('advance-proofs', 'advance-proofs', false)
on conflict (id) do nothing;

create policy "Employees upload bill photos"
on storage.objects for insert
with check (
  bucket_id = 'expense-bills'
  and auth.role() = 'authenticated'
  and (
    public.is_admin()
    or (storage.foldername(name))[1]::uuid = public.current_employee_id()
  )
);

create policy "Employees read own bill photos and admins read all"
on storage.objects for select
using (
  bucket_id = 'expense-bills'
  and auth.role() = 'authenticated'
  and (
    public.is_admin()
    or (storage.foldername(name))[1]::uuid = public.current_employee_id()
  )
);

create policy "Admins delete bill photos"
on storage.objects for delete
using (
  bucket_id = 'expense-bills'
  and public.is_admin()
);

create policy "Admins upload advance proofs"
on storage.objects for insert
with check (
  bucket_id = 'advance-proofs'
  and public.is_admin()
);

create policy "Employees read own advance proofs and admins read all"
on storage.objects for select
using (
  bucket_id = 'advance-proofs'
  and auth.role() = 'authenticated'
  and (
    public.is_admin()
    or (storage.foldername(name))[1]::uuid = public.current_employee_id()
  )
);

create policy "Admins delete advance proofs"
on storage.objects for delete
using (
  bucket_id = 'advance-proofs'
  and public.is_admin()
);

create view public.employee_balances
with (security_invoker = true)
as
select
  e.id as employee_id,
  e.name,
  e.email,
  e.mobile,
  coalesce(sum(a.amount), 0) as total_advances,
  coalesce((
    select sum(x.amount)
    from public.expenses x
    where x.employee_id = e.id and x.status = 'approved'
  ), 0) as total_approved_expenses,
  coalesce(sum(a.amount), 0) - coalesce((
    select sum(x.amount)
    from public.expenses x
    where x.employee_id = e.id and x.status = 'approved'
  ), 0) as available_balance
from public.employees e
left join public.advances a on a.employee_id = e.id
group by e.id, e.name, e.email, e.mobile;
