-- Phase 1 of real accounts: magic-link auth via Supabase Auth, a profile
-- per user, habit ownership, and row-level security so users can only see
-- their own data via a session-scoped client. API routes that still use the
-- service-role key (cron, one-off scripts) bypass RLS by design -- RLS is
-- the boundary for anything reachable with a user's own session.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

-- Auto-create a profile the moment someone signs up (magic-link click).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Ownership. Nullable for now: existing seeded habits have no owner until
-- the first real sign-in, at which point they're assigned via a one-off
-- script (DML, not DDL, so that part doesn't need the SQL editor).
alter table habits add column owner_id uuid references profiles(id);

alter table habits enable row level security;
create policy "Users manage their own habits" on habits
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

alter table checkins enable row level security;
create policy "Users manage checkins on their own habits" on checkins
  for all using (
    habit_id in (select id from habits where owner_id = auth.uid())
  );

alter table ledger_entries enable row level security;
create policy "Users manage ledger entries on their own habits" on ledger_entries
  for all using (
    habit_id in (select id from habits where owner_id = auth.uid())
  );

alter table nudges enable row level security;
create policy "Users manage nudges on their own checkins" on nudges
  for all using (
    checkin_id in (
      select c.id from checkins c
      join habits h on h.id = c.habit_id
      where h.owner_id = auth.uid()
    )
  );

alter table profiles enable row level security;
create policy "Users read their own profile" on profiles
  for select using (id = auth.uid());
