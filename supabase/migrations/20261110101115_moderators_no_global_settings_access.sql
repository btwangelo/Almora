-- Moderators are operational moderators, not site-settings editors.
DROP POLICY IF EXISTS studio_settings_staff_select ON public.studio_settings;
DROP POLICY IF EXISTS studio_settings_staff_insert ON public.studio_settings;
DROP POLICY IF EXISTS studio_settings_staff_update ON public.studio_settings;

CREATE POLICY studio_settings_staff_select
ON public.studio_settings FOR SELECT TO authenticated
USING (
  public.is_owner()
  OR (
    (SELECT public.current_user_role())='admin'
    AND category IN ('personalization','locale','content','community','about')
  )
);

CREATE POLICY studio_settings_staff_insert
ON public.studio_settings FOR INSERT TO authenticated
WITH CHECK (
  updated_by=(SELECT auth.uid())
  AND (
    public.is_owner()
    OR (
      (SELECT public.current_user_role())='admin'
      AND category IN ('personalization','locale','content','community','about')
    )
  )
);

CREATE POLICY studio_settings_staff_update
ON public.studio_settings FOR UPDATE TO authenticated
USING (
  public.is_owner()
  OR (
    (SELECT public.current_user_role())='admin'
    AND category IN ('personalization','locale','content','community','about')
  )
)
WITH CHECK (
  updated_by=(SELECT auth.uid())
  AND (
    public.is_owner()
    OR (
      (SELECT public.current_user_role())='admin'
      AND category IN ('personalization','locale','content','community','about')
    )
  )
);