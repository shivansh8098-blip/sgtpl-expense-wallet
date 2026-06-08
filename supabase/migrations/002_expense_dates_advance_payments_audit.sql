do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_mode') then
    create type public.payment_mode as enum ('Bank Transfer', 'UPI', 'Cash', 'Cheque', 'Other');
  end if;
end $$;

alter table public.expenses
  add column if not exists expense_date date not null default current_date,
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_at timestamptz;

alter table public.advances
  add column if not exists payment_date date not null default current_date,
  add column if not exists payment_mode public.payment_mode not null default 'Bank Transfer',
  add column if not exists proof_urls text[] not null default '{}';

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

drop trigger if exists expenses_set_audit_timestamps on public.expenses;

create trigger expenses_set_audit_timestamps
before update on public.expenses
for each row execute function public.set_expense_audit_timestamps();

insert into storage.buckets (id, name, public)
values ('advance-proofs', 'advance-proofs', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Admins upload advance proofs'
  ) then
    create policy "Admins upload advance proofs"
    on storage.objects for insert
    with check (
      bucket_id = 'advance-proofs'
      and public.is_admin()
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Employees read own advance proofs and admins read all'
  ) then
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
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Admins delete advance proofs'
  ) then
    create policy "Admins delete advance proofs"
    on storage.objects for delete
    using (
      bucket_id = 'advance-proofs'
      and public.is_admin()
    );
  end if;
end $$;

drop view if exists public.employee_balances;

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
