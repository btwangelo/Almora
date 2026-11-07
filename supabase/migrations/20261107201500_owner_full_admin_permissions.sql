-- Give the owner role every administrative permission, including superadmin-only access.
-- Keep the public staff badge as "Dono" only; the internal profile role is no longer the authority source.

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.staff_roles sr
      WHERE sr.user_id = (SELECT auth.uid())
        AND sr.role_key = 'owner'
    ) THEN 'superadmin'
    ELSE (
      SELECT p.role
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
      LIMIT 1
    )
  END;
$function$;

-- Staff-role management must use the same centralized permission check.
DROP POLICY IF EXISTS staff_roles_admin_delete ON public.staff_roles;
CREATE POLICY staff_roles_admin_delete
ON public.staff_roles
FOR DELETE
TO authenticated
USING (
  role_key <> 'owner'
  AND public.is_admin()
);

DROP POLICY IF EXISTS staff_roles_admin_insert ON public.staff_roles;
CREATE POLICY staff_roles_admin_insert
ON public.staff_roles
FOR INSERT
TO authenticated
WITH CHECK (
  role_key <> 'owner'
  AND assigned_by = (SELECT auth.uid())
  AND public.is_admin()
);

-- The owner keeps full privileges through current_user_role()/is_admin(),
-- without retaining a second public "Administrador" staff badge.
DELETE FROM public.staff_roles
WHERE role_key = 'admin'
  AND user_id IN (
    SELECT user_id
    FROM public.staff_roles
    WHERE role_key = 'owner'
  );

UPDATE public.profiles
SET role = 'reader'
WHERE id IN (
  SELECT user_id
  FROM public.staff_roles
  WHERE role_key = 'owner'
)
AND role IN ('admin', 'superadmin');
