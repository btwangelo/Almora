create table if not exists public.page_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  work_id uuid not null references public.works(id) on delete cascade,
  chapter_number text not null,
  page_number integer not null check (page_number >= 0),
  created_at timestamptz not null default now(),
  constraint page_bookmarks_unique unique(user_id,work_id,chapter_number,page_number)
);
create index if not exists page_bookmarks_user_created_idx on public.page_bookmarks(user_id,created_at desc);
alter table public.page_bookmarks enable row level security;
grant select,insert,delete on public.page_bookmarks to authenticated;
drop policy if exists page_bookmarks_select_own on public.page_bookmarks;
create policy page_bookmarks_select_own on public.page_bookmarks for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists page_bookmarks_insert_own on public.page_bookmarks;
create policy page_bookmarks_insert_own on public.page_bookmarks for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists page_bookmarks_delete_own on public.page_bookmarks;
create policy page_bookmarks_delete_own on public.page_bookmarks for delete to authenticated using(user_id=(select auth.uid()));
