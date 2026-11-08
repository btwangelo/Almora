-- ALMORA privacy hardening:
-- 1. Birth dates are not used by the public client and must not be readable by ordinary signed-in users.
--    Age checks continue to run inside the existing SECURITY DEFINER helper.
REVOKE SELECT (birth_date) ON TABLE public.profiles FROM authenticated;

-- 2. Achievement records are visible to their owner and to visitors of public profiles only.
--    This keeps the public profile feature while respecting the profile privacy switch.
ALTER POLICY "user_achievements_public_select"
ON public.user_achievements
USING (
  user_id = (SELECT auth.uid())
  OR private.almora_is_profile_public(user_id)
);
