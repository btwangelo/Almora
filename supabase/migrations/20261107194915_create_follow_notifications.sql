create table public.follow_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  follower_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint follow_notifications_not_self check (user_id <> follower_id)
);

create index follow_notifications_user_created_idx
  on public.follow_notifications (user_id, created_at desc);

alter table public.follow_notifications enable row level security;

create policy "follow_notifications_select_own"
  on public.follow_notifications
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "follow_notifications_update_own"
  on public.follow_notifications
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "follow_notifications_delete_own"
  on public.follow_notifications
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, delete on public.follow_notifications to authenticated;
grant update (read_at) on public.follow_notifications to authenticated;

create or replace function public.almora_notify_new_follower()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.follower_id <> new.following_id then
    insert into public.follow_notifications (user_id, follower_id)
    values (new.following_id, new.follower_id);
  end if;
  return new;
end;
$$;

revoke all on function public.almora_notify_new_follower() from public, anon, authenticated;

create trigger follows_notify_new_follower
after insert on public.follows
for each row
execute function public.almora_notify_new_follower();
