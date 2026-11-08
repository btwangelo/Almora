-- Restrict profile SELECT to fields the client actually uses.
-- Birth date and internal role remain available to trusted database functions,
-- but are not exposed through ordinary authenticated Data API queries.
REVOKE SELECT ON TABLE public.profiles FROM authenticated;
GRANT SELECT (id, username, display_name, avatar_url, bio, created_at)
ON TABLE public.profiles TO authenticated;
