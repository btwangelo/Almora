-- The public site only needs user_id and role_key to render staff badges.
-- Keep internal row IDs, assigner IDs, and timestamps out of ordinary Data API reads.
REVOKE SELECT ON TABLE public.staff_roles FROM anon, authenticated;
GRANT SELECT (user_id, role_key) ON TABLE public.staff_roles TO anon, authenticated;
