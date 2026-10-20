-- Additive migration: preserve applications, notes, files and existing preparation.
alter table public.job_applications add constraint job_applications_id_owner_unique unique(id,user_id);
create table public.star_stories (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(title) between 1 and 250), situation text not null default '', task text not null default '', action text not null default '', result text not null default '', short_version text not null default '',
 skills text[] not null default '{}', principles text[] not null default '{}', language text not null default 'pt' check(language in ('pt','en','fr')),
 status text not null default 'draft' check(status in ('draft','ready')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id),
 check(status <> 'ready' or (length(trim(situation))>0 and length(trim(task))>0 and length(trim(action))>0 and length(trim(result))>0))
);
create table public.job_interviews (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, job_application_id uuid not null,
 interviewer text not null check(length(interviewer) between 1 and 250), starts_at timestamptz not null, duration_minutes integer not null default 60 check(duration_minutes between 5 and 480),
 time_zone text not null default 'Europe/Paris', meeting_url text not null default '' check(meeting_url='' or meeting_url ~ '^https?://'), notes text not null default '', status text not null default 'scheduled' check(status in ('scheduled','completed','cancelled')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(job_application_id,user_id) references public.job_applications(id,user_id) on delete cascade
);
create table public.job_actions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, job_application_id uuid not null,
 title text not null check(length(title) between 1 and 250), due_at timestamptz, waiting_on text not null default 'me' check(waiting_on in ('me','company')), completed boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(job_application_id,user_id) references public.job_applications(id,user_id) on delete cascade
);
create table public.job_star_stories (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, job_application_id uuid not null, story_id uuid not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(job_application_id,story_id),
 foreign key(job_application_id,user_id) references public.job_applications(id,user_id) on delete cascade,
 foreign key(story_id,user_id) references public.star_stories(id,user_id) on delete cascade
);
create index on public.star_stories(user_id,updated_at desc);
create index on public.job_interviews(user_id,starts_at);
create index on public.job_interviews(job_application_id,user_id);
create index on public.job_actions(user_id,completed,due_at);
create index on public.job_actions(job_application_id,user_id);
create index on public.job_star_stories(user_id);
create index on public.job_star_stories(story_id,user_id);
-- Explicit grants plus RLS; no anonymous access and no privileged functions.
do $$ declare t text; begin foreach t in array array['star_stories','job_interviews','job_actions','job_star_stories'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, public',t);
 execute format('grant select, insert, update, delete on public.%I to authenticated',t);
 execute format('create policy owner_access on public.%I for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t);
 end loop; end $$;
-- Move the previously confirmed schedule into editable records; retain original JSON as provenance.
insert into public.job_interviews(user_id,job_application_id,interviewer,starts_at,time_zone,notes)
select j.user_id,j.id,s->>'interviewer',(s->>'starts_at')::timestamptz,coalesce(j.ai_insights_json->>'time_zone','Europe/Paris'),concat('Importado da agenda confirmada.',case when s->>'shadow' is not null then ' Shadow: '||(s->>'shadow') else '' end)
from public.job_applications j cross join lateral jsonb_array_elements(coalesce(j.ai_insights_json->'interview_schedule','[]')) s
where j.id='14a9d281-ab1a-4749-8102-7937010a5667' and j.user_id='44950dc3-d7f7-4bc3-bcb3-21da0bae38a1';
insert into public.job_actions(user_id,job_application_id,title,waiting_on)
select user_id,id,'Revisar histórias STAR para o loop AWS','me' from public.job_applications where id='14a9d281-ab1a-4749-8102-7937010a5667' and user_id='44950dc3-d7f7-4bc3-bcb3-21da0bae38a1'
union all select user_id,id,'Completar perfil e enviar CV à Microsoft','me' from public.job_applications where id='43a92331-6b54-459c-a0e9-694a19bf57a5' and user_id='44950dc3-d7f7-4bc3-bcb3-21da0bae38a1'
union all select user_id,id,'Aguardar retorno de Monika','company' from public.job_applications where id='43a92331-6b54-459c-a0e9-694a19bf57a5' and user_id='44950dc3-d7f7-4bc3-bcb3-21da0bae38a1';
