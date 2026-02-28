import { enforceOverdueRejections } from "@/lib/actions/overdue";
import { createClient } from "@/lib/supabase/server";
import { JobsTable } from "@/components/jobs/jobs-table";

export default async function JobsPage() {
  await enforceOverdueRejections();
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("v_job_applications_enriched")
    .select("*")
    .eq("user_id", user!.id)
    .order("applied_at", { ascending: false });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">My Jobs</h1>
      <JobsTable initialData={data ?? []} userId={user!.id} />
    </div>
  );
}
