-- ALMORA: owner-controlled settings, live site controls and role boundaries.

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT COALESCE((
    SELECT CASE sr.role_key
      WHEN 'owner' THEN 'superadmin'
      WHEN 'admin' THEN 'admin'
      WHEN 'moderator' THEN 'moderator'
      ELSE sr.role_key
    END
    FROM public.staff_roles sr
    WHERE sr.user_id = (SELECT auth.uid())
    ORDER BY CASE sr.role_key WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'moderator' THEN 3 ELSE 4 END
    LIMIT 1
  ), 'reader');
$function$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_roles sr
    WHERE sr.user_id = (SELECT auth.uid()) AND sr.role_key = 'owner'
  );
$function$;

CREATE OR REPLACE FUNCTION public.almora_public_site_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  WITH p AS (SELECT settings FROM public.studio_settings WHERE category='platform'),
       c AS (SELECT settings FROM public.studio_settings WHERE category='community'),
       n AS (SELECT settings FROM public.studio_settings WHERE category='notifications'),
       s AS (SELECT settings FROM public.studio_settings WHERE category='storage')
  SELECT jsonb_build_object(
    'maintenance_mode', CASE WHEN (SELECT settings->>'maintenance_mode' FROM p)='true' THEN true ELSE false END,
    'maintenance_message', COALESCE((SELECT settings->>'maintenance_message' FROM p),'A ALMORA está passando por uma manutenção. Voltaremos em breve.'),
    'public_registration', CASE WHEN (SELECT settings->>'public_registration' FROM p)='false' THEN false ELSE true END,
    'public_catalog', CASE WHEN (SELECT settings->>'public_catalog' FROM p)='false' THEN false ELSE true END,
    'comments_enabled', CASE WHEN (SELECT settings->>'comments_enabled' FROM c)='false' THEN false ELSE true END,
    'reactions_enabled', CASE WHEN (SELECT settings->>'reactions_enabled' FROM c)='false' THEN false ELSE true END,
    'announcements_enabled', CASE WHEN (SELECT settings->>'announcements_enabled' FROM n)='false' THEN false ELSE true END,
    'chapter_alerts_enabled', CASE WHEN (SELECT settings->>'chapter_alerts_enabled' FROM n)='false' THEN false ELSE true END,
    'in_app_notifications', CASE WHEN (SELECT settings->>'in_app_notifications' FROM n)='false' THEN false ELSE true END,
    'r2_max_upload_mb', COALESCE(NULLIF((SELECT settings->>'r2_max_upload_mb' FROM s),'')::integer,80),
    'allowed_extensions', COALESCE((SELECT settings->>'allowed_extensions' FROM s),'jpg,jpeg,png,webp,zip,cbz'),
    'avatar_max_upload_mb', COALESCE(NULLIF((SELECT settings->>'avatar_max_upload_mb' FROM s),'')::integer,50),
    'cover_max_upload_mb', COALESCE(NULLIF((SELECT settings->>'cover_max_upload_mb' FROM s),'')::integer,50),
    'chapter_page_max_upload_mb', COALESCE(NULLIF((SELECT settings->>'chapter_page_max_upload_mb' FROM s),'')::integer,10)
  );
$function$;
GRANT EXECUTE ON FUNCTION public.almora_public_site_status() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.almora_block_closed_registration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_open boolean;
BEGIN
  SELECT CASE WHEN settings->>'public_registration'='false' THEN false ELSE true END
    INTO v_open FROM public.studio_settings WHERE category='platform';
  IF COALESCE(v_open,true)=false THEN
    RAISE EXCEPTION USING ERRCODE='P0001',
      MESSAGE='O cadastro de novas contas está temporariamente fechado pela equipe da ALMORA.';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.almora_block_closed_registration() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS almora_block_closed_registration ON auth.users;
CREATE TRIGGER almora_block_closed_registration
BEFORE INSERT ON auth.users FOR EACH ROW
EXECUTE FUNCTION public.almora_block_closed_registration();

CREATE OR REPLACE FUNCTION public.almora_apply_storage_limits(p_settings jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_r2 integer; v_avatar integer; v_cover integer; v_page integer;
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'Somente o dono pode alterar os limites de armazenamento.'; END IF;
  v_r2:=COALESCE((p_settings->>'r2_max_upload_mb')::integer,80);
  v_avatar:=COALESCE((p_settings->>'avatar_max_upload_mb')::integer,50);
  v_cover:=COALESCE((p_settings->>'cover_max_upload_mb')::integer,50);
  v_page:=COALESCE((p_settings->>'chapter_page_max_upload_mb')::integer,10);
  IF v_r2 NOT BETWEEN 1 AND 80 OR v_avatar NOT BETWEEN 1 AND 50
     OR v_cover NOT BETWEEN 1 AND 50 OR v_page NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'Um ou mais limites de upload estão fora da faixa permitida.';
  END IF;
  UPDATE storage.buckets SET file_size_limit=v_avatar::bigint*1048576 WHERE id='avatars';
  UPDATE storage.buckets SET file_size_limit=v_cover::bigint*1048576 WHERE id='work-covers';
  UPDATE storage.buckets SET file_size_limit=v_page::bigint*1048576 WHERE id='chapter-pages';
  RETURN jsonb_build_object('applied',true,'r2_max_upload_mb',v_r2,'avatar_max_upload_mb',v_avatar,'cover_max_upload_mb',v_cover,'chapter_page_max_upload_mb',v_page);
END;
$function$;
REVOKE ALL ON FUNCTION public.almora_apply_storage_limits(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.almora_apply_storage_limits(jsonb) TO authenticated;

DROP POLICY IF EXISTS studio_settings_staff_select ON public.studio_settings;
DROP POLICY IF EXISTS studio_settings_staff_insert ON public.studio_settings;
DROP POLICY IF EXISTS studio_settings_staff_update ON public.studio_settings;
CREATE POLICY studio_settings_staff_select ON public.studio_settings FOR SELECT TO authenticated
USING (
  public.is_owner()
  OR ((SELECT public.current_user_role())='admin' AND category IN ('personalization','locale','content','community','about'))
  OR ((SELECT public.current_user_role())='moderator' AND category='content')
);
CREATE POLICY studio_settings_staff_insert ON public.studio_settings FOR INSERT TO authenticated
WITH CHECK (
  updated_by=(SELECT auth.uid()) AND (
    public.is_owner()
    OR ((SELECT public.current_user_role())='admin' AND category IN ('personalization','locale','content','community','about'))
    OR ((SELECT public.current_user_role())='moderator' AND category='content')
  )
);
CREATE POLICY studio_settings_staff_update ON public.studio_settings FOR UPDATE TO authenticated
USING (
  public.is_owner()
  OR ((SELECT public.current_user_role())='admin' AND category IN ('personalization','locale','content','community','about'))
  OR ((SELECT public.current_user_role())='moderator' AND category='content')
)
WITH CHECK (
  updated_by=(SELECT auth.uid()) AND (
    public.is_owner()
    OR ((SELECT public.current_user_role())='admin' AND category IN ('personalization','locale','content','community','about'))
    OR ((SELECT public.current_user_role())='moderator' AND category='content')
  )
);

DROP POLICY IF EXISTS staff_roles_admin_insert ON public.staff_roles;
DROP POLICY IF EXISTS staff_roles_admin_delete ON public.staff_roles;
CREATE POLICY staff_roles_owner_insert ON public.staff_roles FOR INSERT TO authenticated
WITH CHECK (public.is_owner() AND role_key<>'owner' AND assigned_by=(SELECT auth.uid()));
CREATE POLICY staff_roles_owner_delete ON public.staff_roles FOR DELETE TO authenticated
USING (public.is_owner() AND role_key<>'owner');

DROP POLICY IF EXISTS works_delete ON public.works;
CREATE POLICY works_delete ON public.works FOR DELETE TO authenticated USING (public.is_owner());
DROP POLICY IF EXISTS chapters_delete ON public.chapters;
CREATE POLICY chapters_delete ON public.chapters FOR DELETE TO authenticated USING (public.is_owner());
DROP POLICY IF EXISTS announcements_admin_delete ON public.announcements;
CREATE POLICY announcements_owner_delete ON public.announcements FOR DELETE TO authenticated USING (public.is_owner());

CREATE OR REPLACE FUNCTION public.can_read_work(target_work_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT (public.almora_public_site_status()->>'public_catalog')='true'
    AND EXISTS (SELECT 1 FROM public.works WHERE id=target_work_id AND status='published');
$function$;

DROP POLICY IF EXISTS comments_insert ON public.comments;
CREATE POLICY comments_insert ON public.comments FOR INSERT TO authenticated
WITH CHECK (
  user_id=(SELECT auth.uid()) AND public.can_read_work(work_id)
  AND (public.almora_public_site_status()->>'comments_enabled')='true'
);

DROP POLICY IF EXISTS chapter_reactions_insert_own ON public.chapter_reactions;
CREATE POLICY chapter_reactions_insert_own ON public.chapter_reactions FOR INSERT TO authenticated
WITH CHECK (
  user_id=(SELECT auth.uid()) AND (public.almora_public_site_status()->>'reactions_enabled')='true'
  AND EXISTS (SELECT 1 FROM public.chapters c WHERE c.id=chapter_reactions.chapter_id AND c.status='published' AND public.can_read_work(c.work_id))
);
DROP POLICY IF EXISTS chapter_reactions_update_own ON public.chapter_reactions;
CREATE POLICY chapter_reactions_update_own ON public.chapter_reactions FOR UPDATE TO authenticated
USING (user_id=(SELECT auth.uid()) AND (public.almora_public_site_status()->>'reactions_enabled')='true')
WITH CHECK (
  user_id=(SELECT auth.uid()) AND (public.almora_public_site_status()->>'reactions_enabled')='true'
  AND EXISTS (SELECT 1 FROM public.chapters c WHERE c.id=chapter_reactions.chapter_id AND c.status='published' AND public.can_read_work(c.work_id))
);

DROP POLICY IF EXISTS announcements_public_read ON public.announcements;
CREATE POLICY announcements_public_read ON public.announcements FOR SELECT TO anon, authenticated
USING (
  (is_published=true AND (public.almora_public_site_status()->>'announcements_enabled')='true')
  OR public.is_admin()
);

CREATE OR REPLACE FUNCTION public.almora_notify_new_chapter()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status='published'
     AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'published')
     AND (public.almora_public_site_status()->>'in_app_notifications')='true'
     AND (public.almora_public_site_status()->>'chapter_alerts_enabled')='true'
  THEN
    INSERT INTO public.chapter_notifications(user_id,work_id,chapter_id)
    SELECT DISTINCT recipients.user_id,NEW.work_id,NEW.id
    FROM (
      SELECT f.user_id FROM public.favorites f WHERE f.work_id=NEW.work_id
      UNION SELECT w.user_id FROM public.wishlists w WHERE w.work_id=NEW.work_id
    ) recipients
    WHERE recipients.user_id IS NOT NULL
    ON CONFLICT(user_id,chapter_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.almora_audit_admin_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_row jsonb; v_target_id uuid;
BEGIN
  IF (public.almora_public_site_status()->>'audit_enabled')='false' THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='DELETE' THEN v_row:=to_jsonb(OLD); ELSE v_row:=to_jsonb(NEW); END IF;
  v_target_id:=nullif(v_row->>'id','')::uuid;
  INSERT INTO public.audit_log(actor_id,action,target_type,target_id,details)
  VALUES(auth.uid(),lower(TG_OP)||':'||TG_TABLE_NAME,TG_TABLE_NAME,v_target_id,jsonb_build_object('operation',TG_OP,'source','database_trigger'));
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;
