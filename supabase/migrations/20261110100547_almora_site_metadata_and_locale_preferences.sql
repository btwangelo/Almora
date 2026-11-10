CREATE OR REPLACE FUNCTION public.almora_public_site_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  WITH p AS (SELECT settings FROM public.studio_settings WHERE category='platform'),
       c AS (SELECT settings FROM public.studio_settings WHERE category='community'),
       n AS (SELECT settings FROM public.studio_settings WHERE category='notifications'),
       s AS (SELECT settings FROM public.studio_settings WHERE category='storage'),
       ct AS (SELECT settings FROM public.studio_settings WHERE category='content'),
       lg AS (SELECT settings FROM public.studio_settings WHERE category='logs'),
       sec AS (SELECT settings FROM public.studio_settings WHERE category='security'),
       brand AS (SELECT settings FROM public.studio_settings WHERE category='personalization'),
       about AS (SELECT settings FROM public.studio_settings WHERE category='about'),
       loc AS (SELECT settings FROM public.studio_settings WHERE category='locale')
  SELECT jsonb_build_object(
    'maintenance_mode',CASE WHEN (SELECT settings->>'maintenance_mode' FROM p)='true' THEN true ELSE false END,
    'maintenance_message',COALESCE((SELECT settings->>'maintenance_message' FROM p),'A ALMORA está passando por uma manutenção. Voltaremos em breve.'),
    'public_registration',CASE WHEN (SELECT settings->>'public_registration' FROM p)='false' THEN false ELSE true END,
    'public_catalog',CASE WHEN (SELECT settings->>'public_catalog' FROM p)='false' THEN false ELSE true END,
    'comments_enabled',CASE WHEN (SELECT settings->>'comments_enabled' FROM c)='false' THEN false ELSE true END,
    'reactions_enabled',CASE WHEN (SELECT settings->>'reactions_enabled' FROM c)='false' THEN false ELSE true END,
    'announcements_enabled',CASE WHEN (SELECT settings->>'announcements_enabled' FROM n)='false' THEN false ELSE true END,
    'chapter_alerts_enabled',CASE WHEN (SELECT settings->>'chapter_alerts_enabled' FROM n)='false' THEN false ELSE true END,
    'in_app_notifications',CASE WHEN (SELECT settings->>'in_app_notifications' FROM n)='false' THEN false ELSE true END,
    'r2_max_upload_mb',COALESCE(NULLIF((SELECT settings->>'r2_max_upload_mb' FROM s),'')::integer,80),
    'allowed_extensions',COALESCE((SELECT settings->>'allowed_extensions' FROM s),'jpg,jpeg,png,webp,zip,cbz'),
    'avatar_max_upload_mb',COALESCE(NULLIF((SELECT settings->>'avatar_max_upload_mb' FROM s),'')::integer,50),
    'cover_max_upload_mb',COALESCE(NULLIF((SELECT settings->>'cover_max_upload_mb' FROM s),'')::integer,50),
    'chapter_page_max_upload_mb',COALESCE(NULLIF((SELECT settings->>'chapter_page_max_upload_mb' FROM s),'')::integer,10),
    'max_chapter_pages',COALESCE(NULLIF((SELECT settings->>'max_chapter_pages' FROM ct),'')::integer,300),
    'max_chapter_mb',COALESCE(NULLIF((SELECT settings->>'max_chapter_mb' FROM ct),'')::integer,120),
    'require_rights',CASE WHEN (SELECT settings->>'require_rights' FROM ct)='false' THEN false ELSE true END,
    'default_age_rating',COALESCE((SELECT settings->>'default_age_rating' FROM ct),'Livre'),
    'audit_enabled',CASE WHEN (SELECT settings->>'audit_enabled' FROM lg)='false' THEN false ELSE true END,
    'session_timeout_minutes',COALESCE(NULLIF((SELECT settings->>'session_timeout_minutes' FROM sec),'')::integer,60),
    'site_name',COALESCE((SELECT settings->>'site_name' FROM brand),'ALMORA'),
    'tagline',COALESCE((SELECT settings->>'tagline' FROM brand),'Onde o amor não precisa de tradução.'),
    'site_description',COALESCE((SELECT settings->>'description' FROM about),'Leia histórias GL e BL na ALMORA. Descubra novas obras, acompanhe capítulos e organize sua biblioteca.'),
    'site_version',COALESCE((SELECT settings->>'version' FROM about),'Em desenvolvimento'),
    'support_url',COALESCE((SELECT settings->>'support_url' FROM about),'https://github.com/btwangelo/Almora/issues'),
    'language',COALESCE((SELECT settings->>'language' FROM loc),'pt-BR'),
    'timezone',COALESCE((SELECT settings->>'timezone' FROM loc),'America/Sao_Paulo'),
    'date_format',COALESCE((SELECT settings->>'date_format' FROM loc),'DD/MM/AAAA')
  );
$function$;