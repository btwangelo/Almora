drop policy if exists profiles_public_read on public.profiles;
create policy profiles_public_read
on public.profiles
for select
to anon, authenticated
using (
  (select auth.uid()) = id
  or private.almora_is_profile_public(id)
);

drop policy if exists profile_appearance_read_public on public.profile_appearance;
create policy profile_appearance_read_public
on public.profile_appearance
for select
to anon, authenticated
using (
  (select auth.uid()) = user_id
  or private.almora_is_profile_public(user_id)
);
