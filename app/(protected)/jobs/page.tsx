import { getWorkspace } from "@/lib/workspace/data";
import { createClient } from "@/lib/supabase/server";
import { JobsTable } from "@/components/jobs/jobs-table";

export default async function JobsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const workspace = await getWorkspace();
  const { data, error } = await supabase
    .from("v_job_applications_enriched")
    .select("*")
    .eq("user_id", user!.id)
    .order("applied_at", { ascending: false });

  if (error) throw new Error("Não foi possível carregar as candidaturas.");
  return (
    <div className="space-y-4">
      <JobsTable
        initialData={data ?? []}
        userId={user!.id}
        interviews={workspace.interviews}
        actions={workspace.actions}
      />
    </div>
  );
}
