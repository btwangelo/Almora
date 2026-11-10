DROP POLICY IF EXISTS profiles_select_visible ON public.profiles;
CREATE POLICY profiles_select_visible
ON public.profiles FOR SELECT TO authenticated
USING (
  id=(SELECT auth.uid())
  OR private.almora_is_profile_public(id)
  OR public.is_owner()
);
