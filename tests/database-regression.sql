-- Run against the migrated database. All fixtures and changes are rolled back.
BEGIN;
SELECT set_config('myhire.test_owner',gen_random_uuid()::text,true), set_config('myhire.test_other',gen_random_uuid()::text,true);
INSERT INTO auth.users(id) VALUES (current_setting('myhire.test_owner')::uuid),(current_setting('myhire.test_other')::uuid);
INSERT INTO public.job_applications(user_id,job_title,company_name,job_url,status,applied_at)
VALUES (current_setting('myhire.test_owner')::uuid,'Test overdue','Regression','https://example.com/test-old','applied',current_date-30),
(current_setting('myhire.test_owner')::uuid,'Test offer','Regression','https://example.com/test-offer','offer',current_date),
(current_setting('myhire.test_other')::uuid,'Other account','Regression','https://example.com/test-other','applied',current_date);
INSERT INTO public.user_cvs(user_id,name) VALUES (current_setting('myhire.test_owner')::uuid,'Regression CV'),(current_setting('myhire.test_other')::uuid,'Other CV');
SELECT set_config('request.jwt.claim.sub',current_setting('myhire.test_owner'),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_cv uuid; v_search uuid; v_job uuid;
BEGIN
  IF (SELECT count(*) FROM public.v_job_applications_enriched) <> 2 THEN RAISE EXCEPTION 'View leaks other users'; END IF;
  IF (SELECT total_active FROM public.v_user_kpis) <> 1 THEN RAISE EXCEPTION 'Incorrect active KPI'; END IF;
  IF (SELECT offer FROM public.v_user_kpis) <> 1 THEN RAISE EXCEPTION 'Incorrect offer KPI'; END IF;
  IF (SELECT application_to_proposal_rate_pct FROM public.v_user_kpis) <> 50 THEN RAISE EXCEPTION 'Incorrect conversion KPI'; END IF;
  IF (SELECT overdue_over_3_weeks FROM public.v_user_kpis) <> 1 THEN RAISE EXCEPTION 'Incorrect overdue KPI'; END IF;
  IF (SELECT status FROM public.job_applications WHERE job_title='Test overdue') <> 'applied' THEN RAISE EXCEPTION 'Read mutated status'; END IF;
  IF has_function_privilege('authenticated','public.mark_overdue_applications_rejected(uuid)','EXECUTE') THEN RAISE EXCEPTION 'Legacy RPC still executable'; END IF;
  SELECT id INTO v_cv FROM public.user_cvs LIMIT 1;
  PERFORM public.set_default_cv(v_cv);
  IF (SELECT count(*) FROM public.user_cvs WHERE is_default) <> 1 THEN RAISE EXCEPTION 'Default CV not set'; END IF;
  INSERT INTO public.job_finder_searches(user_id,cv_id,keywords,generated_query,exclude_job_publishers,status)
  VALUES(auth.uid(),v_cv,'Director','Director in Paris',ARRAY['example'],'processing') RETURNING id INTO v_search;
  INSERT INTO public.job_finder_results(user_id,search_id,job_id_external,job_title,match_score)
  VALUES(auth.uid(),v_search,'regression-1','Director',80);
  IF (SELECT match_label FROM public.job_finder_results WHERE search_id=v_search) <> 'strong' THEN RAISE EXCEPTION 'Match label drift'; END IF;
  UPDATE public.job_finder_searches SET status='completed', total_results=1 WHERE id=v_search;
  INSERT INTO public.job_imports(user_id,source_url,status) VALUES(auth.uid(),'https://example.com/test-import','processing');
  UPDATE public.job_imports SET status='done',extracted_job='{"title":"Director"}' WHERE source_url='https://example.com/test-import';
  BEGIN
    INSERT INTO public.job_finder_searches(user_id,cv_id,keywords,generated_query)
    VALUES(current_setting('myhire.test_other')::uuid,v_cv,'forbidden','forbidden');
    RAISE EXCEPTION 'Cross-user write succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('myhire.test_other'),true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.v_job_applications_enriched) <> 1 THEN RAISE EXCEPTION 'Other user isolation failed'; END IF;
  IF (SELECT count(*) FROM public.job_finder_searches) <> 0 THEN RAISE EXCEPTION 'Search isolation failed'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF has_table_privilege('anon','public.v_job_applications_enriched','SELECT') OR has_table_privilege('anon','public.v_user_kpis','SELECT') THEN RAISE EXCEPTION 'Anonymous view access'; END IF;
  IF has_function_privilege('anon','public.mark_overdue_applications_rejected(uuid)','EXECUTE') OR has_function_privilege('anon','public.set_default_cv(uuid)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous RPC access'; END IF;
END $$;
SELECT 'PASS: ownership, KPI values, read-only overdue, CV defaults, job search, import completion, anonymous privileges' AS regression_result;
ROLLBACK;
