create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint follows_pkey primary key (follower_id, following_id),
  constraint follows_no_self_follow check (follower_id <> following_id)
);

create index if not exists follows_following_id_idx on public.follows (following_id, created_at desc);
create index if not exists follows_follower_id_idx on public.follows (follower_id, created_at desc);

alter table public.follows enable row level security;
grant select, insert, delete on public.follows to authenticated;

drop policy if exists follows_select_visible_relationships on public.follows;
create policy follows_select_visible_relationships
on public.follows for select to authenticated
using (
  follower_id = (select auth.uid())
  or following_id = (select auth.uid())
  or (
    exists (
      select 1 from public.profile_privacy fp
      where fp.user_id = follows.follower_id and fp.profile_public = true
    )
    and exists (
      select 1 from public.profile_privacy tp
      where tp.user_id = follows.following_id and tp.profile_public = true
    )
  )
);

drop policy if exists follows_insert_own on public.follows;
create policy follows_insert_own
on public.follows for insert to authenticated
with check (
  follower_id = (select auth.uid())
  and follower_id <> following_id
);

drop policy if exists follows_delete_own on public.follows;
create policy follows_delete_own
on public.follows for delete to authenticated
using (follower_id = (select auth.uid()));

create table if not exists public.work_favorite_counts (
  work_id uuid primary key references public.works(id) on delete cascade,
  favorites_count bigint not null default 0 check (favorites_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.work_favorite_counts enable row level security;
grant select on public.work_favorite_counts to anon, authenticated;
revoke insert, update, delete on public.work_favorite_counts from anon, authenticated;

drop policy if exists work_favorite_counts_public_read on public.work_favorite_counts;
create policy work_favorite_counts_public_read
on public.work_favorite_counts for select to anon, authenticated
using (true);

insert into public.work_favorite_counts (work_id, favorites_count)
select f.work_id, count(*)::bigint
from public.favorites f
group by f.work_id
on conflict (work_id) do update
set favorites_count = excluded.favorites_count,
    updated_at = now();

create or replace function public.almora_sync_work_favorite_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    insert into public.work_favorite_counts (work_id, favorites_count, updated_at)
    values (new.work_id, 1, now())
    on conflict (work_id) do update
      set favorites_count = public.work_favorite_counts.favorites_count + 1,
          updated_at = now();
    return new;
  elsif tg_op = 'DELETE' then
    update public.work_favorite_counts
       set favorites_count = greatest(0, favorites_count - 1),
           updated_at = now()
     where work_id = old.work_id;
    return old;
  end if;
  return null;
end;
$function$;

revoke all on function public.almora_sync_work_favorite_count() from public, anon, authenticated;

drop trigger if exists favorites_sync_public_count on public.favorites;
create trigger favorites_sync_public_count
after insert or delete on public.favorites
for each row execute function public.almora_sync_work_favorite_count();

create or replace function public.almora_audit_admin_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_row jsonb;
  v_target_id uuid;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  v_target_id := nullif(v_row ->> 'id', '')::uuid;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (
    auth.uid(),
    lower(tg_op) || ':' || tg_table_name,
    tg_table_name,
    v_target_id,
    jsonb_build_object('operation', tg_op, 'source', 'database_trigger')
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

revoke all on function public.almora_audit_admin_activity() from public, anon, authenticated;

drop trigger if exists almora_audit_works on public.works;
create trigger almora_audit_works after insert or update or delete on public.works
for each row execute function public.almora_audit_admin_activity();

drop trigger if exists almora_audit_chapters on public.chapters;
create trigger almora_audit_chapters after insert or update or delete on public.chapters
for each row execute function public.almora_audit_admin_activity();

drop trigger if exists almora_audit_comments on public.comments;
create trigger almora_audit_comments after insert or update or delete on public.comments
for each row execute function public.almora_audit_admin_activity();

drop trigger if exists almora_audit_reports on public.reports;
create trigger almora_audit_reports after insert or update or delete on public.reports
for each row execute function public.almora_audit_admin_activity();

drop trigger if exists almora_audit_staff_roles on public.staff_roles;
create trigger almora_audit_staff_roles after insert or update or delete on public.staff_roles
for each row execute function public.almora_audit_admin_activity();

drop trigger if exists almora_audit_chapter_releases on public.chapter_releases;
create trigger almora_audit_chapter_releases after insert or update or delete on public.chapter_releases
for each row execute function public.almora_audit_admin_activity();
