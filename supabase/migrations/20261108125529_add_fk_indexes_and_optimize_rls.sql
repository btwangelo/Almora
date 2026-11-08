-- ALMORA: add indexes for unindexed foreign keys and cache auth.uid() in RLS policies.
-- These changes preserve authorization logic while reducing row-by-row policy evaluation.



-- Supabase recommends wrapping stable auth helpers in SELECT so PostgreSQL can
-- evaluate them once per statement instead of once per candidate row.

