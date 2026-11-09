-- Tighten the Translate tables to read-only from browser roles.
-- The dedicated Worker uses the service role and performs all writes after validating the user's JWT and staff_roles.
revoke all on public.almora_translation_projects,
  public.almora_translation_files,
  public.almora_translation_pages,
  public.almora_translation_jobs,
  public.almora_translation_glossary,
  public.almora_translation_versions,
  public.almora_translation_reviews,
  public.almora_translation_events
from public, anon, authenticated;

grant select on public.almora_translation_projects,
  public.almora_translation_files,
  public.almora_translation_pages,
  public.almora_translation_jobs,
  public.almora_translation_glossary,
  public.almora_translation_versions,
  public.almora_translation_reviews,
  public.almora_translation_events
to authenticated;

-- Avoid depending on the legacy SECURITY DEFINER is_admin() RPC inside the new RLS policy.
drop policy almora_translation_projects_read on public.almora_translation_projects;
create policy almora_translation_projects_read on public.almora_translation_projects
for select to authenticated
using (
  created_by = (select auth.uid())
  or assigned_translator_id = (select auth.uid())
  or exists (
    select 1 from public.staff_roles sr
    where sr.user_id = (select auth.uid())
      and sr.role_key in ('owner','admin')
  )
  or (
    status in ('editorial_review','changes_requested','approved','published')
    and exists (
      select 1 from public.staff_roles sr
      where sr.user_id = (select auth.uid())
        and sr.role_key in ('editor_bl','editor_gl','reviewer')
    )
  )
);

-- Cover all foreign keys flagged by the performance advisor.
create index almora_translation_projects_linked_work_idx on public.almora_translation_projects(linked_work_id);
create index almora_translation_projects_linked_chapter_idx on public.almora_translation_projects(linked_chapter_id);
create index almora_translation_files_uploaded_by_idx on public.almora_translation_files(uploaded_by);
create index almora_translation_pages_source_file_idx on public.almora_translation_pages(source_file_id);
create index almora_translation_jobs_page_idx on public.almora_translation_jobs(page_id);
create index almora_translation_versions_created_by_idx on public.almora_translation_versions(created_by);
create index almora_translation_versions_approved_by_idx on public.almora_translation_versions(approved_by);
create index almora_translation_versions_linked_work_idx on public.almora_translation_versions(linked_work_id);
create index almora_translation_versions_linked_chapter_idx on public.almora_translation_versions(linked_chapter_id);
create index almora_translation_reviews_reviewer_idx on public.almora_translation_reviews(reviewer_id);
create index almora_translation_reviews_version_idx on public.almora_translation_reviews(version_id);
create index almora_translation_events_actor_idx on public.almora_translation_events(actor_id);
