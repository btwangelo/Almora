-- Restore least-privilege read access required by public staff badges and the owner team screen.
-- Row-level security remains enabled; writes remain restricted by the existing owner-only policies.
grant select (user_id, role_key) on public.staff_roles to anon;
grant select (id, user_id, role_key, created_at) on public.staff_roles to authenticated;
