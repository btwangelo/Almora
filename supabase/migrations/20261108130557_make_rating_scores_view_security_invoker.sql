-- The rating projection must obey the caller's privileges and RLS.
-- The ratings_read policy intentionally permits public score aggregation, while
-- column grants keep user identifiers out of the anonymous API.
CREATE OR REPLACE VIEW public.work_rating_scores
WITH (security_invoker = true)
AS
SELECT work_id, score
FROM public.ratings;
