create table if not exists public.job_finder_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cv_id uuid not null,
  query text not null,
  country text,
  language text,
  location text,
  remote_only boolean not null default false,
  date_posted text,
  employment_types text[] not null default '{}',
  job_requirements text[] not null default '{}',
  radius integer,
  exclude_job_publishers text,
  page integer not null default 1,
  num_pages integer not null default 1,
  total_results integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_finder_results (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.job_finder_searches(id) on delete cascade,
  job_id_external text not null,
  job_title text,
  employer_name text,
  employer_logo text,
  employer_website text,
  job_publisher text,
  job_employment_type text,
  job_employment_types text[] not null default '{}',
  job_apply_link text,
  job_apply_is_direct boolean,
  job_google_link text,
  job_description text,
  job_is_remote boolean,
  job_posted_at text,
  job_posted_at_timestamp bigint,
  job_posted_at_datetime_utc text,
  job_location text,
  job_city text,
  job_state text,
  job_country text,
  job_latitude numeric,
  job_longitude numeric,
  job_min_salary numeric,
  job_max_salary numeric,
  job_salary text,
  job_salary_period text,
  match_score integer not null default 0,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (search_id, job_id_external)
);

create index if not exists idx_job_finder_searches_user_id on public.job_finder_searches(user_id);
create index if not exists idx_job_finder_searches_created_at on public.job_finder_searches(created_at desc);
create index if not exists idx_job_finder_results_search_id on public.job_finder_results(search_id);
create index if not exists idx_job_finder_results_created_at on public.job_finder_results(created_at desc);
create index if not exists idx_job_finder_results_job_id_external on public.job_finder_results(job_id_external);

alter table public.job_finder_searches enable row level security;
alter table public.job_finder_results enable row level security;

drop policy if exists "job_finder_searches_select_own" on public.job_finder_searches;
create policy "job_finder_searches_select_own" on public.job_finder_searches for select using (auth.uid() = user_id);

drop policy if exists "job_finder_searches_insert_own" on public.job_finder_searches;
create policy "job_finder_searches_insert_own" on public.job_finder_searches for insert with check (auth.uid() = user_id);

drop policy if exists "job_finder_searches_update_own" on public.job_finder_searches;
create policy "job_finder_searches_update_own" on public.job_finder_searches for update using (auth.uid() = user_id);

drop policy if exists "job_finder_results_select_own" on public.job_finder_results;
create policy "job_finder_results_select_own" on public.job_finder_results
for select using (
  exists (
    select 1 from public.job_finder_searches s
    where s.id = search_id and s.user_id = auth.uid()
  )
);

drop policy if exists "job_finder_results_insert_own" on public.job_finder_results;
create policy "job_finder_results_insert_own" on public.job_finder_results
for insert with check (
  exists (
    select 1 from public.job_finder_searches s
    where s.id = search_id and s.user_id = auth.uid()
  )
);

drop policy if exists "job_finder_results_update_own" on public.job_finder_results;
create policy "job_finder_results_update_own" on public.job_finder_results
for update using (
  exists (
    select 1 from public.job_finder_searches s
    where s.id = search_id and s.user_id = auth.uid()
  )
);
