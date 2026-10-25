-- ══════════════════════════════════════════════════════════════════════════════
-- 0001_init.sql — CBE Exam Analysis cloud schema (REQ-DB1..DB3)
-- Personal CBE Exam Analysis · Supabase / Postgres
--
-- Tables: profiles, learners, learning_areas, strands, sub_strands, slos,
--         exams, questions, results, action_plan_items, user_settings
--         (+ competencies — a v1 domain feature that is per-learner data).
-- Every table: id uuid pk, user_id → auth.users, created_at, updated_at
-- (trigger-maintained), deleted_at (soft delete for sync).
-- RLS is ENABLED **and** FORCED on every table; no view/table is exposed
-- without it. Cross-user isolation is provable via supabase/rls_test.sql.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Helper: keep updated_at fresh ────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. profiles — one row per auth user (created by trigger below)
-- ══════════════════════════════════════════════════════════════════════════════
create table public.profiles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. learners — unlimited learners per account (REQ-ML1)
-- ══════════════════════════════════════════════════════════════════════════════
create table public.learners (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  grade       int  not null check (grade between 1 and 12),
  school      text not null default '',
  school_year text not null default to_char(now(), 'YYYY'),
  colour      text not null default '#6366f1',
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index learners_user_idx     on public.learners (user_id);
create index learners_grade_idx    on public.learners (user_id, grade);

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. curriculum tables — learning areas → strands → sub-strands → SLOs
-- ══════════════════════════════════════════════════════════════════════════════
create table public.learning_areas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  learner_id  uuid not null references public.learners (id) on delete cascade,
  name        text not null,
  colour      text not null default '#6366f1',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index learning_areas_user_idx    on public.learning_areas (user_id);
create index learning_areas_learner_idx on public.learning_areas (learner_id);

create table public.strands (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  learner_id       uuid not null references public.learners (id) on delete cascade,
  learning_area_id uuid not null references public.learning_areas (id) on delete cascade,
  code             text not null,
  name             text not null,
  sort_order       int  not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index strands_user_idx        on public.strands (user_id);
create index strands_learner_idx     on public.strands (learner_id);
create index strands_learning_area_idx on public.strands (learning_area_id);

create table public.sub_strands (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  learner_id uuid not null references public.learners (id) on delete cascade,
  strand_id  uuid not null references public.strands (id) on delete cascade,
  code       text not null,
  name       text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index sub_strands_user_idx    on public.sub_strands (user_id);
create index sub_strands_learner_idx on public.sub_strands (learner_id);
create index sub_strands_strand_idx  on public.sub_strands (strand_id);

create table public.slos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  learner_id    uuid not null references public.learners (id) on delete cascade,
  sub_strand_id uuid not null references public.sub_strands (id) on delete cascade,
  code          text not null,
  description   text not null,
  weight        numeric not null default 1 check (weight > 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index slos_user_idx     on public.slos (user_id);
create index slos_learner_idx  on public.slos (learner_id);
create index slos_substrand_idx on public.slos (sub_strand_id);

create table public.competencies (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  learner_id uuid not null references public.learners (id) on delete cascade,
  name       text not null,
  short_name text not null,
  colour     text not null default '#6366f1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index competencies_user_idx    on public.competencies (user_id);
create index competencies_learner_idx on public.competencies (learner_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. exams, questions, results
-- ══════════════════════════════════════════════════════════════════════════════
create table public.exams (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  learner_id       uuid not null references public.learners (id) on delete cascade,
  title            text not null,
  type             text not null check (type in ('Formative','CAT','Mid-term','End-term')),
  term             int  not null check (term in (1, 2, 3)),
  exam_date        date not null,
  learning_area_id uuid not null references public.learning_areas (id) on delete cascade,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index exams_user_idx        on public.exams (user_id);
create index exams_learner_idx     on public.exams (learner_id);
create index exams_learning_area_idx on public.exams (learning_area_id);

create table public.questions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  learner_id           uuid not null references public.learners (id) on delete cascade,
  exam_id              uuid not null references public.exams (id) on delete cascade,
  number               int  not null check (number >= 1),
  max_marks            numeric not null check (max_marks >= 1),
  slo_id               uuid not null references public.slos (id) on delete cascade,
  performance_indicator text not null default '',
  cognitive_level      text not null check (cognitive_level in ('Recall','Understanding','Application','Higher-order')),
  competency_ids       jsonb not null default '[]'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz
);
create index questions_user_idx   on public.questions (user_id);
create index questions_learner_idx on public.questions (learner_id);
create index questions_exam_idx   on public.questions (exam_id);
create index questions_slo_idx    on public.questions (slo_id);

create table public.results (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  learner_id  uuid not null references public.learners (id) on delete cascade,
  exam_id     uuid not null references public.exams (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  marks_scored numeric not null check (marks_scored >= 0),
  error_type   text check (error_type in ('Knowledge gap','Application error','Careless mistake','Time pressure','Misread question')),
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index results_user_idx     on public.results (user_id);
create index results_learner_idx  on public.results (learner_id);
create index results_exam_idx     on public.results (exam_id);
create index results_question_idx on public.results (question_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. action plan
-- ══════════════════════════════════════════════════════════════════════════════
create table public.action_plan_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  learner_id   uuid not null references public.learners (id) on delete cascade,
  slo_id       uuid not null references public.slos (id) on delete cascade,
  activity     text not null,
  practice_task text not null default '',
  target_level text not null check (target_level in ('EE','ME','AE','BE')),
  review_date  date,
  completed    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index action_plan_items_user_idx    on public.action_plan_items (user_id);
create index action_plan_items_learner_idx on public.action_plan_items (learner_id);
create index action_plan_items_slo_idx     on public.action_plan_items (slo_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- 6. user_settings — one JSON document row per user
-- ══════════════════════════════════════════════════════════════════════════════
create table public.user_settings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index user_settings_user_idx on public.user_settings (user_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- 7. Triggers: updated_at + provenance stamping/verification
-- ══════════════════════════════════════════════════════════════════════════════
-- Every table gets an updated_at trigger and (except profiles, learners,
-- user_settings) a trigger verifying the learner belongs to the same user
-- and stamping user_id + learner provenance.

do $$
declare
  t text;
begin
  -- updated_at on every table
  foreach t in array array['profiles','learners','learning_areas','strands','sub_strands',
                           'slos','competencies','exams','questions','results',
                           'action_plan_items','user_settings']
  loop
    execute format('create trigger trg_%s_updated before update on public.%I
                    for each row execute function public.set_updated_at();', t, t);
  end loop;
end $$;

-- Learner ownership verification on child tables (safeguard REQ-DB3):
-- stamp the caller's user id and verify the learner belongs to that user.
create or replace function public.verify_learner_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Stamp the caller's user id (RLS also enforces equality).
  new.user_id := auth.uid();
  if not exists (
    select 1 from public.learners l
    where l.id = new.learner_id and l.user_id = new.user_id and l.deleted_at is null
  ) then
    raise exception 'learner % does not belong to the calling user', new.learner_id;
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['learning_areas','strands','sub_strands','slos',
                           'competencies','exams','questions','results','action_plan_items']
  loop
    execute format('create trigger trg_%s_owner before insert or update on public.%I
                    for each row execute function public.verify_learner_owner();', t, t);
  end loop;
end $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 8. Profile auto-creation on signup (REQ-DB3)
-- ══════════════════════════════════════════════════════════════════════════════
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ══════════════════════════════════════════════════════════════════════════════
-- 9. Row Level Security — ENABLE + FORCE on every table (REQ-DB3)
-- ══════════════════════════════════════════════════════════════════════════════
do $$
declare
  t text;
  tables_arr text[] := array['profiles','learners','learning_areas','strands','sub_strands',
                             'slos','competencies','exams','questions','results',
                             'action_plan_items','user_settings'];
begin
  foreach t in array tables_arr
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);

    -- SELECT: own rows only
    execute format($p$
      create policy %I on public.%I for select to authenticated
      using ((select auth.uid()) = user_id and deleted_at is null);
    $p$, t || '_select', t);

    -- INSERT: own rows only, WITH CHECK
    execute format($p$
      create policy %I on public.%I for insert to authenticated
      with check ((select auth.uid()) = user_id);
    $p$, t || '_insert', t);

    -- UPDATE: own rows only, WITH CHECK (owner stays owner)
    execute format($p$
      create policy %I on public.%I for update to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
    $p$, t || '_update', t);

    -- DELETE: own rows only
    execute format($p$
      create policy %I on public.%I for delete to authenticated
      using ((select auth.uid()) = user_id);
    $p$, t || '_delete', t);
  end loop;
end $$;

-- profiles.id mirrors the user id for convenience (same uuid)
alter table public.profiles enable row level security;
alter table public.profiles force  row level security;

-- ══════════════════════════════════════════════════════════════════════════════
-- 10. Realtime — publish user-owned tables (filtered by RLS per subscriber)
-- ══════════════════════════════════════════════════════════════════════════════
alter publication supabase_realtime add table
  public.learners, public.learning_areas, public.strands, public.sub_strands,
  public.slos, public.competencies, public.exams, public.questions,
  public.results, public.action_plan_items, public.user_settings;

-- ══════════════════════════════════════════════════════════════════════════════
-- Grant nothing to anon: the `authenticated` role holds DML only through RLS.
-- (Supabase grants are default; RLS policies above bind them to the owner.)
-- ══════════════════════════════════════════════════════════════════════════════
