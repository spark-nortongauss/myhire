import { createClient } from "@/lib/supabase/server";
import { getInterviewPrepList } from "@/lib/interview-prep/data";
import { InterviewPrepTable } from "@/components/interview-prep/interview-prep-table";

export default async function InterviewPrepPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const rows = user ? await getInterviewPrepList(supabase, user.id) : [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Interview Prep</h1>
      <InterviewPrepTable initialRows={rows} />
    </div>
  );
}
