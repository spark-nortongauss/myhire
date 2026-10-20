-- Distinct published requisition IDs must not collapse on title/location alone.
CREATE OR REPLACE FUNCTION public.import_discovered_jobs(p_user_id uuid, p_jobs jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  item jsonb;
  v_url text;
  v_title text;
  v_company text;
  v_location text;
  v_external_id text;
  v_existing uuid;
  v_id uuid;
  v_inserted jsonb := '[]';
  v_skipped jsonb := '[]';
BEGIN
  IF p_user_id IS NULL OR jsonb_typeof(p_jobs) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'An owner and a JSON array of jobs are required';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('myhire:discovery:' || p_user_id::text, 0));
  FOR item IN SELECT value FROM jsonb_array_elements(p_jobs) LOOP
    v_url := trim(coalesce(item->>'job_url',''));
    v_title := trim(coalesce(item->>'job_title',''));
    v_company := trim(coalesce(item->>'company_name',''));
    v_location := trim(coalesce(item->>'location',''));
    v_external_id := nullif(trim(coalesce(item->>'requisition_id','')),'');
    IF v_url !~ '^https?://[^[:space:]]+$' OR length(v_url)>2000 OR v_title='' OR v_company='' THEN
      RAISE EXCEPTION 'Each job requires a title, company and valid HTTP(S) URL';
    END IF;
    SELECT j.id INTO v_existing FROM public.job_applications j
    WHERE j.user_id=p_user_id AND (
      j.job_url=v_url OR
      (lower(trim(j.company_name))=lower(v_company) AND (
        (v_external_id IS NOT NULL AND j.ai_insights_json->'discovery'->>'requisition_id'=v_external_id) OR
        (lower(trim(j.job_title))=lower(v_title) AND
          (v_external_id IS NULL OR j.ai_insights_json->'discovery'->>'requisition_id' IS NULL) AND
          (coalesce(trim(j.location),'')='' OR v_location='' OR lower(trim(j.location))=lower(v_location)))
      ))
    ) LIMIT 1;
    IF v_existing IS NOT NULL THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object('id',v_existing,'job_url',v_url));
      CONTINUE;
    END IF;
    INSERT INTO public.job_applications(
      user_id,job_title,company_name,job_url,status,applied_at,platform,
      location,country,work_mode,brief_description,job_description,salary_text,
      salary_min,salary_max,salary_currency,notes,ai_insights,ai_insights_json
    ) VALUES (
      p_user_id,v_title,v_company,v_url,'not_applied',NULL,'company_website',
      nullif(v_location,''),nullif(item->>'country',''),
      (CASE WHEN item->>'work_mode' IN ('remote','hybrid','on_site') THEN item->>'work_mode' ELSE 'unknown' END)::public.work_mode,
      nullif(item->>'brief_description',''),nullif(item->>'job_description',''),nullif(item->>'salary_text',''),
      nullif(item->>'salary_min','')::numeric,nullif(item->>'salary_max','')::numeric,
      nullif(item->>'salary_currency',''),nullif(item->>'notes',''),nullif(item->>'ai_insights',''),
      (CASE WHEN jsonb_typeof(item->'metadata')='object' THEN item->'metadata' ELSE '{}'::jsonb END) ||
      jsonb_build_object('discovery',jsonb_build_object('source','daily_executive_search',
        'requisition_id',v_external_id,'first_discovered_at',now(),
        'application_url',coalesce(nullif(item->>'application_url',''),v_url),
        'source_url',coalesce(nullif(item->>'source_url',''),v_url)))
    ) ON CONFLICT DO NOTHING RETURNING id INTO v_id;
    IF v_id IS NOT NULL THEN
      v_inserted := v_inserted || jsonb_build_array(jsonb_build_object('id',v_id,'job_title',v_title,'company_name',v_company,'job_url',v_url));
    ELSE
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object('job_url',v_url));
    END IF;
  END LOOP;
  RETURN jsonb_build_object('inserted_count',jsonb_array_length(v_inserted),'skipped_count',jsonb_array_length(v_skipped),'inserted',v_inserted,'skipped',v_skipped);
END;
$$;
REVOKE ALL ON FUNCTION public.import_discovered_jobs(uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_discovered_jobs(uuid,jsonb) TO service_role;
