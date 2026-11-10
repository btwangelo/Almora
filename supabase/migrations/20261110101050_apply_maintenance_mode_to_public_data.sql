-- During maintenance, keep published catalogue data and public announcements behind RLS.
CREATE OR REPLACE FUNCTION public.can_read_work(target_work_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    (public.almora_public_site_status()->>'maintenance_mode')='false'
    AND (public.almora_public_site_status()->>'public_catalog')='true'
    AND EXISTS (
      SELECT 1 FROM public.works
      WHERE id=target_work_id AND status='published'
    );
$function$;

DROP POLICY IF EXISTS announcements_public_read ON public.announcements;
CREATE POLICY announcements_public_read ON public.announcements
FOR SELECT TO anon, authenticated
USING (
  (
    is_published=true
    AND (public.almora_public_site_status()->>'announcements_enabled')='true'
    AND (public.almora_public_site_status()->>'maintenance_mode')='false'
  )
  OR public.is_admin()
);

DROP POLICY IF EXISTS chapter_releases_public_select ON public.chapter_releases;
CREATE POLICY chapter_releases_public_select ON public.chapter_releases
FOR SELECT TO anon, authenticated
USING (
  (
    (public.almora_public_site_status()->>'maintenance_mode')='false'
    AND (public.almora_public_site_status()->>'public_catalog')='true'
  )
  OR public.is_staff()
);

CREATE OR REPLACE FUNCTION public.almora_notify_new_chapter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status='published'
     AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'published')
     AND (public.almora_public_site_status()->>'maintenance_mode')='false'
     AND (public.almora_public_site_status()->>'in_app_notifications')='true'
     AND (public.almora_public_site_status()->>'chapter_alerts_enabled')='true'
  THEN
    INSERT INTO public.chapter_notifications(user_id,work_id,chapter_id)
    SELECT DISTINCT recipients.user_id,NEW.work_id,NEW.id
    FROM (
      SELECT f.user_id FROM public.favorites f WHERE f.work_id=NEW.work_id
      UNION
      SELECT w.user_id FROM public.wishlists w WHERE w.work_id=NEW.work_id
    ) recipients
    WHERE recipients.user_id IS NOT NULL
    ON CONFLICT(user_id,chapter_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;