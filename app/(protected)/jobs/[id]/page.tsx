import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JobDetailsClient } from "@/components/jobs/job-details-client";

export default async function JobDetailsPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data } = await supabase.from("v_job_applications_enriched").select("*").eq("id", params.id).eq("user_id", user!.id).maybeSingle();

  if (!data) return notFound();

  return <JobDetailsClient data={data} />;
}
