import { startOfWeek, format } from "date-fns";
import { enforceOverdueRejections } from "@/lib/actions/overdue";
import { createClient } from "@/lib/supabase/server";
import { FunnelChart, PlatformsChart, WeeklyChart } from "@/components/dashboard/charts";

export default async function DashboardPage() {
  await enforceOverdueRejections();
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: kpi } = await supabase.from("v_user_kpis").select("*").eq("user_id", user!.id).maybeSingle();
  const { data: jobs } = await supabase
    .from("v_job_applications_enriched")
    .select("status, platform, applied_at")
    .eq("user_id", user!.id);

  const statusMap = new Map<string, number>();
  const weekMap = new Map<string, number>();
  const platformMap = new Map<string, number>();

  for (const row of jobs ?? []) {
    statusMap.set(row.status, (statusMap.get(row.status) ?? 0) + 1);
    if (row.platform) platformMap.set(row.platform, (platformMap.get(row.platform) ?? 0) + 1);
    if (row.applied_at) {
      const week = format(startOfWeek(new Date(row.applied_at), { weekStartsOn: 1 }), "MMM d");
      weekMap.set(week, (weekMap.get(week) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          ["Applied", kpi?.applied_count ?? 0],
          ["Proposal", kpi?.proposal_count ?? 0],
          ["Interview", kpi?.interview_count ?? 0],
          ["Offer", kpi?.offer_count ?? 0],
          ["Rejected", kpi?.rejected_count ?? 0],
          ["No Answer", kpi?.no_answer_count ?? 0],
          ["Total Active", kpi?.total_active ?? 0],
          ["Overdue >3w", kpi?.overdue_count ?? 0]
        ].map(([label, value]) => (
          <div key={label} className="card">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      <div className="card">
        <p className="text-sm text-muted-foreground">Application → Proposal Rate</p>
        <p className="text-xl font-semibold">{Number(kpi?.app_to_proposal_rate ?? 0).toFixed(1)}%</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <FunnelChart data={Array.from(statusMap, ([status, count]) => ({ status, count }))} />
        <WeeklyChart data={Array.from(weekMap, ([week, count]) => ({ week, count }))} />
        <PlatformsChart data={Array.from(platformMap, ([platform, count]) => ({ platform, count }))} />
      </div>
    </div>
  );
}
