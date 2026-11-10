-- Tighten editorial permissions and enforce content rules in the database.

DROP POLICY IF EXISTS works_insert ON public.works;
CREATE POLICY works_insert ON public.works FOR INSERT TO authenticated
WITH CHECK ((SELECT public.current_user_role()) IN ('superadmin','admin'));

DROP POLICY IF EXISTS works_update ON public.works;
CREATE POLICY works_update ON public.works FOR UPDATE TO authenticated
USING ((SELECT public.current_user_role()) IN ('superadmin','admin'))
WITH CHECK ((SELECT public.current_user_role()) IN ('superadmin','admin'));

DROP POLICY IF EXISTS chapters_insert ON public.chapters;
CREATE POLICY chapters_insert ON public.chapters FOR INSERT TO authenticated
WITH CHECK ((SELECT public.current_user_role()) IN ('superadmin','admin'));

DROP POLICY IF EXISTS chapters_update ON public.chapters;
CREATE POLICY chapters_update ON public.chapters FOR UPDATE TO authenticated
USING ((SELECT public.current_user_role()) IN ('superadmin','admin'))
WITH CHECK ((SELECT public.current_user_role()) IN ('superadmin','admin'));

DROP POLICY IF EXISTS pages_insert ON public.pages;
CREATE POLICY pages_insert ON public.pages FOR INSERT TO authenticated
WITH CHECK ((SELECT public.current_user_role()) IN ('superadmin','admin'));

DROP POLICY IF EXISTS pages_update ON public.pages;
CREATE POLICY pages_update ON public.pages FOR UPDATE TO authenticated
USING ((SELECT public.current_user_role()) IN ('superadmin','admin'))
WITH CHECK ((SELECT public.current_user_role()) IN ('superadmin','admin'));

DROP POLICY IF EXISTS pages_delete ON public.pages;
CREATE POLICY pages_delete ON public.pages FOR DELETE TO authenticated
USING (public.is_owner());

DROP POLICY IF EXISTS chapter_releases_staff_insert ON public.chapter_releases;
CREATE POLICY chapter_releases_staff_insert ON public.chapter_releases FOR INSERT TO authenticated
WITH CHECK (
  (SELECT public.current_user_role()) IN ('superadmin','admin')
  AND (created_by IS NULL OR created_by=(SELECT auth.uid()))
);

DROP POLICY IF EXISTS chapter_releases_staff_update ON public.chapter_releases;
CREATE POLICY chapter_releases_staff_update ON public.chapter_releases FOR UPDATE TO authenticated
USING ((SELECT public.current_user_role()) IN ('superadmin','admin'))
WITH CHECK ((SELECT public.current_user_role()) IN ('superadmin','admin'));

DROP POLICY IF EXISTS chapter_releases_staff_delete ON public.chapter_releases;
CREATE POLICY chapter_releases_owner_delete ON public.chapter_releases FOR DELETE TO authenticated
USING (public.is_owner());

ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint NOT NULL DEFAULT 0;
ALTER TABLE public.pages
  ADD CONSTRAINT pages_file_size_bytes_nonnegative CHECK (file_size_bytes >= 0);

CREATE OR REPLACE FUNCTION public.almora_enforce_work_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_settings jsonb;
  v_require_rights boolean;
  v_default_rating text;
BEGIN
  SELECT settings INTO v_settings
  FROM public.studio_settings
  WHERE category='content';

  v_require_rights := COALESCE((v_settings->>'require_rights')::boolean,true);
  v_default_rating := COALESCE(NULLIF(v_settings->>'default_age_rating',''),'Livre');

  IF (TG_OP='INSERT' OR NEW.rights_holder IS DISTINCT FROM OLD.rights_holder)
     AND v_require_rights
     AND NULLIF(btrim(COALESCE(NEW.rights_holder,'')),'') IS NULL THEN
    RAISE EXCEPTION 'Informe o titular dos direitos ou a licença antes de cadastrar a obra.';
  END IF;

  IF TG_OP='INSERT' AND NULLIF(btrim(COALESCE(NEW.age_rating,'')),'') IS NULL THEN
    NEW.age_rating := v_default_rating;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS almora_enforce_work_settings ON public.works;
CREATE TRIGGER almora_enforce_work_settings
BEFORE INSERT OR UPDATE OF rights_holder, age_rating ON public.works
FOR EACH ROW EXECUTE FUNCTION public.almora_enforce_work_settings();

CREATE OR REPLACE FUNCTION public.almora_enforce_chapter_page_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_limit integer;
  v_row record;
  v_count bigint;
BEGIN
  SELECT COALESCE(NULLIF(settings->>'max_chapter_pages','')::integer,300)
  INTO v_limit
  FROM public.studio_settings
  WHERE category='content';
  v_limit := COALESCE(v_limit,300);

  FOR v_row IN SELECT DISTINCT chapter_id FROM new_pages LOOP
    SELECT count(*) INTO v_count
    FROM public.pages
    WHERE chapter_id=v_row.chapter_id;

    IF v_count > v_limit THEN
      RAISE EXCEPTION 'Este capítulo ultrapassa o limite de % páginas configurado pela ALMORA.',v_limit;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS almora_enforce_page_count_insert ON public.pages;
CREATE TRIGGER almora_enforce_page_count_insert
AFTER INSERT ON public.pages
REFERENCING NEW TABLE AS new_pages
FOR EACH STATEMENT EXECUTE FUNCTION public.almora_enforce_chapter_page_count();

DROP TRIGGER IF EXISTS almora_enforce_page_count_update ON public.pages;
CREATE TRIGGER almora_enforce_page_count_update
AFTER UPDATE ON public.pages
REFERENCING NEW TABLE AS new_pages
FOR EACH STATEMENT EXECUTE FUNCTION public.almora_enforce_chapter_page_count();
