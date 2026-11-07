-- Resolve staff-role permissions centrally: owner is superadmin; admin staff role is admin.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.staff_roles sr
      WHERE sr.user_id = (SELECT auth.uid())
        AND sr.role_key = 'owner'
    ) THEN 'superadmin'
    WHEN EXISTS (
      SELECT 1 FROM public.staff_roles sr
      WHERE sr.user_id = (SELECT auth.uid())
        AND sr.role_key = 'admin'
    ) THEN 'admin'
    ELSE (
      SELECT p.role
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
      LIMIT 1
    )
  END;
$function$;
