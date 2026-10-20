-- All fixtures are isolated from real users and rolled back, even on success.
BEGIN;
SELECT set_config('myhire.test_owner',gen_random_uuid()::text,true),set_config('myhire.test_other',gen_random_uuid()::text,true);
INSERT INTO auth.users(id) VALUES(current_setting('myhire.test_owner')::uuid),(current_setting('myhire.test_other')::uuid);
DO $$
DECLARE owner_id uuid := current_setting('myhire.test_owner')::uuid; other_id uuid := current_setting('myhire.test_other')::uuid; result jsonb; new_id uuid;
BEGIN
  result := public.import_discovered_jobs(owner_id,'[{"job_title":"Operations Director","company_name":"Regression","job_url":"https://example.com/not-applied","location":"Paris"},{"job_title":"Operations Director","company_name":"Regression","job_url":"https://example.com/repost","location":"Paris"}]');
  IF (result->>'inserted_count')::int<>1 OR (result->>'skipped_count')::int<>1 THEN RAISE EXCEPTION 'Import is not idempotent within a batch'; END IF;
  new_id := (result->'inserted'->0->>'id')::uuid;
  IF (SELECT status<>'not_applied' OR applied_at IS NOT NULL FROM public.job_applications WHERE id=new_id) THEN RAISE EXCEPTION 'Discovered job marked applied'; END IF;
  IF (SELECT is_overdue OR days_since_applied IS NOT NULL FROM public.v_job_applications_enriched WHERE id=new_id) THEN RAISE EXCEPTION 'Discovered job counted as overdue'; END IF;
  IF (SELECT not_applied<>1 OR total_active<>0 FROM public.v_user_kpis WHERE user_id=owner_id) THEN RAISE EXCEPTION 'Incorrect discovered KPI'; END IF;
  UPDATE public.job_applications SET status='applied' WHERE id=new_id;
  IF (SELECT applied_at IS DISTINCT FROM CURRENT_DATE FROM public.job_applications WHERE id=new_id) THEN RAISE EXCEPTION 'Applying did not set date'; END IF;
  result := public.import_discovered_jobs(owner_id,'[{"job_title":"Operations Director","company_name":"Regression","job_url":"https://example.com/not-applied"}]');
  IF (result->>'inserted_count')::int<>0 OR (SELECT status<>'applied' FROM public.job_applications WHERE id=new_id) THEN RAISE EXCEPTION 'Reimport overwrote manual status'; END IF;
  UPDATE public.job_applications SET status='offer' WHERE id=new_id;
  result := public.import_discovered_jobs(owner_id,'[{"job_title":"Regional Director","company_name":"Regression","job_url":"https://example.com/another"}]');
  IF (SELECT application_to_proposal_rate_pct<>100 FROM public.v_user_kpis WHERE user_id=owner_id) THEN RAISE EXCEPTION 'Unapplied job diluted conversion'; END IF;
  result := public.import_discovered_jobs(other_id,'[{"job_title":"Operations Director","company_name":"Regression","job_url":"https://example.com/not-applied"}]');
  IF (result->>'inserted_count')::int<>1 THEN RAISE EXCEPTION 'Deduplication leaked across owners'; END IF;
  result := public.import_discovered_jobs(owner_id,'[{"job_title":"Director","company_name":"Distinct requisitions","job_url":"https://example.com/req1","requisition_id":"REQ-1","location":"Paris"},{"job_title":"Director","company_name":"Distinct requisitions","job_url":"https://example.com/req2","requisition_id":"REQ-2","location":"Paris"}]');
  IF (result->>'inserted_count')::int<>2 THEN RAISE EXCEPTION 'Distinct requisitions incorrectly merged'; END IF;
  IF has_function_privilege('anon','public.import_discovered_jobs(uuid,jsonb)','EXECUTE') OR has_function_privilege('authenticated','public.import_discovered_jobs(uuid,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Import publicly callable'; END IF;
  IF NOT has_function_privilege('service_role','public.import_discovered_jobs(uuid,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Automation cannot import'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('myhire.test_owner'),true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.v_job_applications_enriched)<>4 THEN RAISE EXCEPTION 'RLS owner isolation failed'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: discovery import, deduplication, manual status preservation, application dates, KPIs and access control; fixtures rolled back' AS result;
