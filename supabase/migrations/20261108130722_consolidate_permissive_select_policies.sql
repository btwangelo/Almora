-- Combine equivalent permissive SELECT policies to reduce repeated RLS evaluation.
-- The predicates preserve the existing visibility and ownership rules.

DROP POLICY IF EXISTS library_public_read ON public.library;
DROP POLICY IF EXISTS library_select_own ON public.library;
CREATE POLICY library_select_visible
ON public.library
FOR SELECT
TO anon, authenticated
USING (
  user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.profile_privacy pp
    WHERE pp.user_id = library.user_id
      AND pp.library_public = true
  )
);

DROP POLICY IF EXISTS profiles_public_read ON public.profiles;
DROP POLICY IF EXISTS profiles_select_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_visible
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (
  id = (SELECT auth.uid())
  OR private.almora_is_profile_public(id)
  OR (SELECT public.is_admin())
);

DROP POLICY IF EXISTS progress_own ON public.progress;
DROP POLICY IF EXISTS progress_public_read ON public.progress;
CREATE POLICY progress_select_visible
ON public.progress
FOR SELECT
TO anon, authenticated
USING (
  user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.profile_privacy pp
    WHERE pp.user_id = progress.user_id
      AND pp.history_public = true
  )
);

CREATE POLICY progress_insert_own
ON public.progress
FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY progress_update_own
ON public.progress
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY progress_delete_own
ON public.progress
FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));
