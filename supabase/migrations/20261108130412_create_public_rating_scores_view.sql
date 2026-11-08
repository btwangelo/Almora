-- Public rating summaries need only the work and score, never the rating owner's identity.
-- This view intentionally bypasses the base table's row policy but exposes only these two public fields.
CREATE OR REPLACE VIEW public.work_rating_scores
WITH (security_invoker = false)
AS
SELECT work_id, score
FROM public.ratings;

REVOKE ALL ON public.work_rating_scores FROM PUBLIC;
GRANT SELECT ON public.work_rating_scores TO anon, authenticated;
