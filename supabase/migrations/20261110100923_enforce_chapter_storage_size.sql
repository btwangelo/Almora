CREATE OR REPLACE FUNCTION public.almora_enforce_chapter_page_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_limit integer;
  v_max_bytes bigint;
  v_row record;
  v_count bigint;
  v_bytes bigint;
BEGIN
  SELECT
    COALESCE(NULLIF(settings->>'max_chapter_pages','')::integer,300),
    COALESCE(NULLIF(settings->>'max_chapter_mb','')::integer,120)::bigint * 1048576
  INTO v_limit,v_max_bytes
  FROM public.studio_settings
  WHERE category='content';
  v_limit:=COALESCE(v_limit,300);
  v_max_bytes:=COALESCE(v_max_bytes,120::bigint*1048576);

  FOR v_row IN SELECT DISTINCT chapter_id FROM new_pages LOOP
    SELECT count(*),COALESCE(sum(file_size_bytes),0)
    INTO v_count,v_bytes
    FROM public.pages
    WHERE chapter_id=v_row.chapter_id;

    IF v_count>v_limit THEN
      RAISE EXCEPTION 'Este capítulo ultrapassa o limite de % páginas configurado pela ALMORA.',v_limit;
    END IF;
    IF v_bytes>v_max_bytes THEN
      RAISE EXCEPTION 'Este capítulo ultrapassa o limite de % MB armazenados configurado pela ALMORA.',v_max_bytes/1048576;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$function$;