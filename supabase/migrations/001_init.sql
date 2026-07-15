-- Habit Stakes v1 schema. Run in the Supabase SQL editor.

create extension if not exists vector;

create table habits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cadence text not null check (cadence in ('daily', 'weekly')),
  stake_amount numeric(8,2) not null check (stake_amount > 0),
  owed_to text not null,
  implementation_intention text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table checkins (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references habits(id) on delete cascade,
  period_start date not null,
  status text not null check (status in ('hit', 'miss', 'pending')),
  note text,
  note_embedding vector(1536),
  embedding_model text,
  auto_converted boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  -- one check-in per habit per cadence period; cron idempotency depends on this
  unique (habit_id, period_start)
);

create table ledger_entries (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references habits(id) on delete cascade,
  -- unique: a miss can never double-bill (checkins <-> ledger_entries strictly 1:1)
  checkin_id uuid not null unique references checkins(id) on delete cascade,
  owed_by text not null default 'me',
  owed_to text not null,
  amount numeric(8,2) not null,
  settled boolean not null default false,
  created_at timestamptz not null default now()
);

create table nudges (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references checkins(id) on delete cascade,
  generated_text text not null,
  retrieved_checkin_ids uuid[] not null,
  similarity_scores real[] not null,
  feedback text check (feedback in ('up', 'down')),
  created_at timestamptz not null default now()
);

-- Vercel cron is best-effort: every run logs here so silent failure is queryable
create table cron_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  periods_processed int not null
);

-- Cosine similarity search over all past check-in notes (hits and misses).
-- similarity = 1 - cosine distance; caller applies the grounding floor (~0.75).
create or replace function match_checkins(
  query_embedding vector(1536),
  match_count int,
  exclude_checkin uuid
) returns table (
  id uuid,
  habit_id uuid,
  note text,
  status text,
  period_start date,
  similarity double precision
)
language sql stable as $$
  select c.id, c.habit_id, c.note, c.status, c.period_start,
         1 - (c.note_embedding <=> query_embedding) as similarity
  from checkins c
  where c.note_embedding is not null
    and c.id <> exclude_checkin
  order by c.note_embedding <=> query_embedding
  limit match_count;
$$;

-- Recovery-rate instrumentation: each nudge -> its miss -> next-period status.
create view nudge_outcomes as
select
  n.id as nudge_id,
  n.created_at as nudged_at,
  n.feedback,
  c.id as miss_checkin_id,
  c.habit_id,
  h.name as habit_name,
  c.period_start as miss_period,
  h.cadence,
  nxt.status as next_period_status,
  (nxt.status = 'hit') as recovered
from nudges n
join checkins c on c.id = n.checkin_id
join habits h on h.id = c.habit_id
left join checkins nxt
  on nxt.habit_id = c.habit_id
  and nxt.period_start = c.period_start
      + (case h.cadence when 'daily' then 1 else 7 end);

-- Wider lens for the nudged-vs-unnudged comparison: ALL misses, with
-- whether a nudge fired and what happened next period. Directional only
-- (see CLAUDE.md monitoring section for confounds).
create view miss_outcomes as
select
  c.id as miss_checkin_id,
  c.habit_id,
  h.name as habit_name,
  c.period_start as miss_period,
  h.cadence,
  c.auto_converted,
  (c.note is not null) as had_note,
  (n.id is not null) as nudged,
  nxt.status as next_period_status,
  (nxt.status = 'hit') as recovered
from checkins c
join habits h on h.id = c.habit_id
left join nudges n on n.checkin_id = c.id
left join checkins nxt
  on nxt.habit_id = c.habit_id
  and nxt.period_start = c.period_start
      + (case h.cadence when 'daily' then 1 else 7 end)
where c.status = 'miss';
