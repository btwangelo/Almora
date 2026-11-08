create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.almora_is_profile_public(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce((
    select pp.profile_public
    from public.profile_privacy pp
    where pp.user_id = p_user_id
  ), false);
$function$;

revoke all on function private.almora_is_profile_public(uuid) from public, anon;
grant execute on function private.almora_is_profile_public(uuid) to authenticated;

drop policy if exists follows_select_visible_relationships on public.follows;
create policy follows_select_visible_relationships
on public.follows for select to authenticated
using (
  follower_id = (select auth.uid())
  or following_id = (select auth.uid())
  or (
    private.almora_is_profile_public(follower_id)
    and private.almora_is_profile_public(following_id)
  )
);
