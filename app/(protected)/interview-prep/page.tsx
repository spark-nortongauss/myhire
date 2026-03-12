import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getInterviewPrepList } from "@/lib/interview-prep/data";

export default async function InterviewPrepPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const rows = user ? await getInterviewPrepList(supabase, user.id) : [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Interview Prep</h1>
      <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/90">
            <tr>
              <th className="px-3 py-2 text-left">Job title</th>
              <th className="px-3 py-2 text-left">Company name</th>
              <th className="px-3 py-2 text-left">Interview stage</th>
              <th className="px-3 py-2 text-left">Interview type</th>
              <th className="px-3 py-2 text-left">Prep status</th>
              <th className="px-3 py-2 text-left">Overall readiness score</th>
              <th className="px-3 py-2 text-left">Last session date</th>
              <th className="px-3 py-2 text-left">Updated at</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-border hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-indigo-700 hover:underline">
                    <Link href={`/interview-prep/${row.id}`}>{row.job_title || "Untitled job"}</Link>
                  </td>
                  <td className="px-3 py-2">{row.company_name || "Unknown"}</td>
                  <td className="px-3 py-2">{row.interview_stage || "general"}</td>
                  <td className="px-3 py-2">{row.interview_type || "general"}</td>
                  <td className="px-3 py-2">{row.prep_status || "in_preparation"}</td>
                  <td className="px-3 py-2">{Math.round(Number(row.overall_readiness_score ?? 0))}</td>
                  <td className="px-3 py-2">{row.last_session_at ? new Date(row.last_session_at).toLocaleString() : "-"}</td>
                  <td className="px-3 py-2">{row.updated_at ? new Date(row.updated_at).toLocaleString() : "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-6 text-center text-muted-foreground" colSpan={8}>
                  No interview prep items yet. Move a job to interview status to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
