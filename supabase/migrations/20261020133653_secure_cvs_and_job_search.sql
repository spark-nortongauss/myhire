-- Security and persistence fixes. This migration does not delete application data.
ALTER VIEW public.v_job_applications_enriched SET (security_invoker = true);
ALTER VIEW public.v_user_kpis SET (security_invoker = true);
REVOKE ALL ON public.v_job_applications_enriched, public.v_user_kpis FROM PUBLIC, anon;
GRANT SELECT ON public.v_job_applications_enriched, public.v_user_kpis TO authenticated;

-- Retire the old globally callable auto-rejection RPC without breaking scheduled callers.
CREATE OR REPLACE FUNCTION public.mark_overdue_applications_rejected(p_user_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT 0; $$;
REVOKE ALL ON FUNCTION public.mark_overdue_applications_rejected(uuid) FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.ensure_interview_prep(uuid, uuid) SET search_path = '';
ALTER FUNCTION public.set_updated_at() SET search_path = '';
ALTER FUNCTION public.touch_status_updated_at() SET search_path = '';
ALTER FUNCTION public.validate_interview_prep_interviewers() SET search_path = '';
ALTER FUNCTION public.validate_interview_prep_interviewer_values() SET search_path = '';

-- A text-only profile is valid; PDFs can be attached later.
ALTER TABLE public.user_cvs ALTER COLUMN file_path DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_cvs_one_default_per_user ON public.user_cvs(user_id) WHERE is_default;

CREATE OR REPLACE FUNCTION public.set_default_cv(p_cv_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));
  PERFORM 1 FROM public.user_cvs WHERE id = p_cv_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CV not found' USING ERRCODE = '42501'; END IF;
  UPDATE public.user_cvs SET is_default = false WHERE user_id = v_user_id AND is_default;
  UPDATE public.user_cvs SET is_default = true WHERE id = p_cv_id AND user_id = v_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_default_cv(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_default_cv(uuid) TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_cvs, public.job_finder_searches, public.job_finder_results TO authenticated;

-- Preserve the view's existing column order and append fields used by job details.
CREATE OR REPLACE VIEW public.v_job_applications_enriched WITH (security_invoker = true) AS
SELECT id,user_id,job_title,company_name,status,platform,work_mode,job_url,
 brief_description,job_description,location,industry,salary_text,salary_min,salary_max,salary_currency,
 applied_at,last_activity_at,status_updated_at,ai_insights,ai_insights_json,notes,cv_file_path,
 cover_letter_file_path,archived,created_at,updated_at,
 (now()::date - applied_at) AS days_since_applied,
 (NOT archived AND status IN ('applied','no_answer','proposal','interview') AND (now()::date - applied_at)>21) AS is_overdue,
 country,match_score
FROM public.job_applications;

CREATE OR REPLACE VIEW public.v_user_kpis WITH (security_invoker = true) AS
SELECT user_id,
 count(*) FILTER (WHERE NOT archived AND status IN ('applied','no_answer','proposal','interview')) AS total_active,
 count(*) FILTER (WHERE NOT archived AND status='applied') AS applied,
 count(*) FILTER (WHERE NOT archived AND status='proposal') AS proposal,
 count(*) FILTER (WHERE NOT archived AND status='interview') AS interview,
 count(*) FILTER (WHERE NOT archived AND status='offer') AS offer,
 count(*) FILTER (WHERE NOT archived AND status='rejected') AS rejected,
 count(*) FILTER (WHERE NOT archived AND status='no_answer') AS no_answer,
 coalesce(round(100.0 * count(*) FILTER (WHERE NOT archived AND status IN ('proposal','interview','offer')) /
 nullif(count(*) FILTER (WHERE NOT archived),0),2),0) AS application_to_proposal_rate_pct,
 count(*) FILTER (WHERE NOT archived AND status IN ('applied','no_answer','proposal','interview') AND (now()::date-applied_at)>21) AS overdue_over_3_weeks
FROM public.job_applications GROUP BY user_id;

-- Parent ownership must match, even when requests bypass the application server.
CREATE UNIQUE INDEX IF NOT EXISTS user_cvs_id_owner ON public.user_cvs(id,user_id);
CREATE UNIQUE INDEX IF NOT EXISTS job_finder_searches_id_owner ON public.job_finder_searches(id,user_id);
ALTER TABLE public.job_finder_searches ADD CONSTRAINT job_finder_searches_cv_owner_fkey
 FOREIGN KEY (cv_id,user_id) REFERENCES public.user_cvs(id,user_id) ON DELETE CASCADE;
ALTER TABLE public.job_finder_results ADD CONSTRAINT job_finder_results_search_owner_fkey
 FOREIGN KEY (search_id,user_id) REFERENCES public.job_finder_searches(id,user_id) ON DELETE CASCADE;
