import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JobFinderResultsClient } from "@/components/job-finder/job-finder-results-client";

export default async function JobFinderResultsPage({ params }: { params: { searchId: string } }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return notFound();

  const { data: search } = await supabase
    .from("job_finder_searches")
    .select("id,query,country,language,location,remote_only,date_posted,employment_types,job_requirements,total_results")
    .eq("id", params.searchId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!search) return notFound();

  const { data: results } = await supabase
    .from("job_finder_results")
    .select("id,job_title,employer_name,employer_logo,job_publisher,job_employment_type,job_is_remote,job_location,job_posted_at,job_salary,job_description,job_apply_link,job_google_link,match_score")
    .eq("search_id", search.id)
    .order("created_at", { ascending: false });

  return <JobFinderResultsClient search={search} results={results ?? []} />;
}
