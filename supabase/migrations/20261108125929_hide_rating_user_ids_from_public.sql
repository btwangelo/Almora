-- Public readers need only work_id and score to calculate community averages.
-- Keep user_id and timestamps private to authenticated operations.
REVOKE SELECT ON TABLE public.ratings FROM anon;
GRANT SELECT (work_id, score) ON TABLE public.ratings TO anon;
