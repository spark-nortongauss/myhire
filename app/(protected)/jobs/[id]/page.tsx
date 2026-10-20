import { getWorkspace } from "@/lib/workspace/data";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JobDetailsClient } from "@/components/jobs/job-details-client";

export default async function JobDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("v_job_applications_enriched")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user!.id)
    .maybeSingle();

  if (error) throw new Error("Não foi possível carregar a candidatura.");
  if (!data) return notFound();

  const [workspace, prep, events] = await Promise.all([
    getWorkspace(params.id),
    supabase
      .from("interview_prep")
      .select("id")
      .eq("user_id", user!.id)
      .eq("job_application_id", params.id)
      .maybeSingle(),
    supabase
      .from("job_events")
      .select("*")
      .eq("user_id", user!.id)
      .eq("job_application_id", params.id)
      .order("event_at", { ascending: false }),
  ]);
  if (prep.error || events.error)
    throw new Error("Não foi possível carregar o histórico.");
  return (
    <JobDetailsClient
      data={data}
      workspace={workspace}
      prepId={prep.data?.id || null}
      events={events.data || []}
    />
  );
}
