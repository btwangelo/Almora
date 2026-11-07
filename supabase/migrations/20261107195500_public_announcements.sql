-- ALMORA public announcements and per-user read tracking
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 140),
  body text not null check (length(btrim(body)) between 1 and 12000),
  image_url text,
  link_url text,
  is_published boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint announcements_published_at_check check (not is_published or published_at is not null)
);
create index if not exists announcements_publication_idx
  on public.announcements (published_at desc) where is_published = true;
alter table public.announcements enable row level security;
drop policy if exists announcements_public_read on public.announcements;
create policy announcements_public_read on public.announcements
  for select to anon, authenticated using (is_published = true or (select public.is_admin()));
drop policy if exists announcements_admin_insert on public.announcements;
create policy announcements_admin_insert on public.announcements
  for insert to authenticated with check ((select public.is_admin()) and created_by = (select auth.uid()));
drop policy if exists announcements_admin_update on public.announcements;
create policy announcements_admin_update on public.announcements
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists announcements_admin_delete on public.announcements;
create policy announcements_admin_delete on public.announcements
  for delete to authenticated using ((select public.is_admin()));
revoke all privileges on table public.announcements from anon, authenticated;
grant select on public.announcements to anon;
grant select, insert, update, delete on public.announcements to authenticated;

create table if not exists public.announcement_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, announcement_id)
);
alter table public.announcement_reads enable row level security;
drop policy if exists announcement_reads_select_own on public.announcement_reads;
create policy announcement_reads_select_own on public.announcement_reads
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists announcement_reads_insert_own on public.announcement_reads;
create policy announcement_reads_insert_own on public.announcement_reads
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists announcement_reads_update_own on public.announcement_reads;
create policy announcement_reads_update_own on public.announcement_reads
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists announcement_reads_delete_own on public.announcement_reads;
create policy announcement_reads_delete_own on public.announcement_reads
  for delete to authenticated using (user_id = (select auth.uid()));
revoke all privileges on table public.announcement_reads from anon, authenticated;
revoke all privileges (user_id, announcement_id, read_at) on table public.announcement_reads from authenticated;
grant select, insert, delete on public.announcement_reads to authenticated;
grant update (read_at) on public.announcement_reads to authenticated;

-- Images reuse the existing public work-covers bucket.
-- Its existing Storage RLS policies allow public reads and uploads only by admins.
