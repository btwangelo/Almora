-- ALMORA Translate: isolated project, file, page, queue, glossary and editorial records.
-- All writes are performed by the dedicated server-side Worker using its service credential.
-- Browser clients receive SELECT only, guarded by RLS.

create table public.almora_translation_projects (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  assigned_translator_id uuid references auth.users(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 240),
  source_language text not null,
  target_language text not null default 'pt-BR',
  translation_style text not null default 'adaptive' check (translation_style in ('adaptive')),
  status text not null default 'pending_upload'
    check (status in ('pending_upload','uploaded','queued','processing','translator_review','editorial_review','changes_requested','approved','published','failed','cancelled')),
  linked_work_id uuid references public.works(id) on delete set null,
  linked_chapter_id uuid references public.chapters(id) on delete set null,
  rights_confirmed boolean not null default false,
  narrative_context text,
  settings jsonb not null default '{}'::jsonb,
  total_files integer not null default 0 check (total_files >= 0),
  total_pages integer not null default 0 check (total_pages >= 0),
  completed_pages integer not null default 0 check (completed_pages >= 0),
  failed_pages integer not null default 0 check (failed_pages >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz
);

create table public.almora_translation_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.almora_translation_projects(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  original_name text not null,
  object_key text not null unique,
  mime_type text not null,
  file_extension text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  checksum_sha256 text,
  file_kind text not null check (file_kind in ('archive','pdf','image')),
  page_count integer not null default 0 check (page_count >= 0),
  status text not null default 'uploaded' check (status in ('uploaded','validating','extracted','rejected','failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.almora_translation_pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.almora_translation_projects(id) on delete cascade,
  source_file_id uuid references public.almora_translation_files(id) on delete set null,
  page_number integer not null check (page_number > 0),
  original_object_key text not null,
  translated_object_key text,
  status text not null default 'queued'
    check (status in ('queued','ocr','translating','reconstructing','lettering','quality_check','completed','needs_attention','failed')),
  detected_language text,
  confidence numeric(5,4) check (confidence between 0 and 1),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  ocr_data jsonb not null default '{}'::jsonb,
  quality_report jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (project_id, page_number)
);

create table public.almora_translation_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.almora_translation_projects(id) on delete cascade,
  page_id uuid references public.almora_translation_pages(id) on delete cascade,
  job_type text not null check (job_type in ('validate','extract','ocr','translate','reconstruct','lettering','quality_check','package')),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  idempotency_key text not null unique,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  finished_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.almora_translation_glossary (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.almora_translation_projects(id) on delete cascade,
  source_term text not null check (char_length(btrim(source_term)) between 1 and 240),
  target_term text not null check (char_length(btrim(target_term)) between 1 and 240),
  term_type text not null default 'general'
    check (term_type in ('character','nickname','honorific','place','term','sound_effect','general')),
  notes text,
  voice_profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, source_term)
);

create table public.almora_translation_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.almora_translation_projects(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  output_format text not null check (output_format in ('zip','cbz','images')),
  object_prefix text not null,
  status text not null default 'draft' check (status in ('draft','editorial_review','approved','published','superseded')),
  created_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  published_at timestamptz,
  linked_work_id uuid references public.works(id) on delete set null,
  linked_chapter_id uuid references public.chapters(id) on delete set null,
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (project_id, version_number)
);

create table public.almora_translation_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.almora_translation_projects(id) on delete cascade,
  version_id uuid references public.almora_translation_versions(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  review_type text not null check (review_type in ('translator','editorial')),
  decision text not null check (decision in ('submitted','approved','rejected','changes_requested')),
  notes text,
  created_at timestamptz not null default now()
);

create table public.almora_translation_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.almora_translation_projects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index almora_translation_projects_creator_idx on public.almora_translation_projects(created_by, created_at desc);
create index almora_translation_projects_assignee_idx on public.almora_translation_projects(assigned_translator_id, status);
create index almora_translation_projects_review_idx on public.almora_translation_projects(status, submitted_at);
create index almora_translation_files_project_idx on public.almora_translation_files(project_id, created_at);
create index almora_translation_pages_project_status_idx on public.almora_translation_pages(project_id, status, page_number);
create index almora_translation_jobs_queue_idx on public.almora_translation_jobs(status, available_at) where status = 'queued';
create index almora_translation_jobs_project_idx on public.almora_translation_jobs(project_id, created_at);
create index almora_translation_glossary_project_idx on public.almora_translation_glossary(project_id);
create index almora_translation_versions_project_idx on public.almora_translation_versions(project_id, version_number desc);
create index almora_translation_reviews_project_idx on public.almora_translation_reviews(project_id, created_at desc);
create index almora_translation_events_project_idx on public.almora_translation_events(project_id, created_at desc);

alter table public.almora_translation_projects enable row level security;
alter table public.almora_translation_files enable row level security;
alter table public.almora_translation_pages enable row level security;
alter table public.almora_translation_jobs enable row level security;
alter table public.almora_translation_glossary enable row level security;
alter table public.almora_translation_versions enable row level security;
alter table public.almora_translation_reviews enable row level security;
alter table public.almora_translation_events enable row level security;

create policy almora_translation_projects_read on public.almora_translation_projects
for select to authenticated
using (
  created_by = (select auth.uid())
  or assigned_translator_id = (select auth.uid())
  or (select public.is_admin())
  or (
    status in ('editorial_review','changes_requested','approved','published')
    and exists (
      select 1 from public.staff_roles sr
      where sr.user_id = (select auth.uid())
        and sr.role_key in ('editor_bl','editor_gl','reviewer')
    )
  )
);

-- Child records inherit visibility from their parent project. No browser-side writes are granted.
create policy almora_translation_files_read on public.almora_translation_files
for select to authenticated
using (exists (select 1 from public.almora_translation_projects p where p.id = project_id));

create policy almora_translation_pages_read on public.almora_translation_pages
for select to authenticated
using (exists (select 1 from public.almora_translation_projects p where p.id = project_id));

create policy almora_translation_jobs_read on public.almora_translation_jobs
for select to authenticated
using (exists (select 1 from public.almora_translation_projects p where p.id = project_id));

create policy almora_translation_glossary_read on public.almora_translation_glossary
for select to authenticated
using (exists (select 1 from public.almora_translation_projects p where p.id = project_id));

create policy almora_translation_versions_read on public.almora_translation_versions
for select to authenticated
using (exists (select 1 from public.almora_translation_projects p where p.id = project_id));

create policy almora_translation_reviews_read on public.almora_translation_reviews
for select to authenticated
using (exists (select 1 from public.almora_translation_projects p where p.id = project_id));

create policy almora_translation_events_read on public.almora_translation_events
for select to authenticated
using (exists (select 1 from public.almora_translation_projects p where p.id = project_id));

grant select on
  public.almora_translation_projects,
  public.almora_translation_files,
  public.almora_translation_pages,
  public.almora_translation_jobs,
  public.almora_translation_glossary,
  public.almora_translation_versions,
  public.almora_translation_reviews,
  public.almora_translation_events
to authenticated;

comment on table public.almora_translation_projects is 'ALMORA Translate projects; mutations are server-side only.';
comment on table public.almora_translation_files is 'Original and generated files stored in the existing R2 bucket under encrypted ALMORA Translate keys.';
comment on table public.almora_translation_pages is 'Per-page processing state, OCR confidence and visual QA.';
comment on table public.almora_translation_jobs is 'Idempotent asynchronous processing queue and retry state.';
comment on table public.almora_translation_glossary is 'Per-work terminology, character names, honorifics and voice context.';
comment on table public.almora_translation_versions is 'Independent output versions with mandatory editorial approval before publication.';
comment on table public.almora_translation_reviews is 'Translator and editorial review decisions.';
comment on table public.almora_translation_events is 'Audit trail for ALMORA Translate project activity.';
