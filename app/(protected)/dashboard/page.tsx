import { format, startOfDay, startOfMonth, startOfQuarter, startOfWeek } from "date-fns";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BriefcaseBusiness, ChartNoAxesCombined, Lightbulb, ListFilter, PieChart } from "lucide-react";
import { enforceOverdueRejections } from "@/lib/actions/overdue";
import { createClient } from "@/lib/supabase/server";
import { FunnelChart, PlatformsChart, TrendChart, WeeklyTrendMini } from "@/components/dashboard/charts";

const ranges = ["day", "week", "month", "quarter"] as const;
type Range = (typeof ranges)[number];
const getBucketDate = (date: Date, range: Range) => range === "day" ? startOfDay(date) : range === "week" ? startOfWeek(date, { weekStartsOn: 1 }) : range === "month" ? startOfMonth(date) : startOfQuarter(date);
const getBucketLabel = (date: Date, range: Range) => range === "month" ? format(date, "MMM yyyy") : range === "quarter" ? format(date, "QQQ yyyy") : format(date, "MMM d");

export default async function DashboardPage({ searchParams }: { searchParams?: { range?: string } }) {
  await enforceOverdueRejections();
  const range = ranges.includes(searchParams?.range as Range) ? (searchParams?.range as Range) : "week";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: kpi } = await supabase.from("v_user_kpis").select("*").eq("user_id", user!.id).maybeSingle();
  const { data: jobs } = await supabase.from("v_job_applications_enriched").select("status, platform, applied_at").eq("user_id", user!.id);

  const statusMap = new Map<string, number>();
  const platformMap = new Map<string, number>();
  const periodMap = new Map<string, { date: Date; count: number }>();
  for (const row of jobs ?? []) {
    statusMap.set(row.status, (statusMap.get(row.status) ?? 0) + 1);
    if (row.platform) platformMap.set(row.platform, (platformMap.get(row.platform) ?? 0) + 1);
    if (!row.applied_at) continue;
    const date = getBucketDate(new Date(row.applied_at), range);
    const key = date.toISOString();
    periodMap.set(key, { date, count: (periodMap.get(key)?.count ?? 0) + 1 });
  }

  const trendData = Array.from(periodMap.values()).sort((l, r) => l.date.getTime() - r.date.getTime()).map((item) => ({ period: getBucketLabel(item.date, range), count: item.count }));
  const nowBucket = getBucketDate(new Date(), range).getTime();
  const currentPeriodCount = Array.from(periodMap.values()).find((item) => item.date.getTime() === nowBucket)?.count ?? 0;
  const last = trendData.at(-1)?.count ?? 0;
  const prev = trendData.at(-2)?.count ?? 0;
  const trendIcon = last > prev ? ArrowUpRight : last < prev ? ArrowDownRight : ArrowRight;
  const trendLabel = last > prev ? "Up" : last < prev ? "Down" : "Stable";
  const conversionRate = Number(kpi?.app_to_proposal_rate ?? 0);
  const TrendIcon = trendIcon;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Live view of your pipeline performance and hiring momentum.</p>
        </div>
        <div className="inline-flex rounded-xl border border-border/70 bg-panel/90 p-1">
          {ranges.map((item) => <Link key={item} href={`/dashboard?range=${item}`} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${range === item ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-muted"}`}>{item}</Link>)}
        </div>
      </div>

      <div className="card flex items-center justify-between border-indigo-100">
        <div>
          <p className="text-sm text-muted-foreground">Applications in current {range}</p>
          <p className="mt-1 flex items-center gap-2 text-3xl font-black text-indigo-600"><BriefcaseBusiness size={20} />{currentPeriodCount}</p>
          <p className="mt-1 flex items-center gap-1 text-sm text-slate-600"><TrendIcon size={14} className="text-indigo-500" /> {trendLabel} vs previous ({prev})</p>
        </div>
        <WeeklyTrendMini data={trendData} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[ ["Applied", kpi?.applied_count ?? 0], ["Proposal", kpi?.proposal_count ?? 0], ["Interview", kpi?.interview_count ?? 0], ["Offer", kpi?.offer_count ?? 0], ["Rejected", kpi?.rejected_count ?? 0], ["No Answer", kpi?.no_answer_count ?? 0], ["Total Active", kpi?.total_active ?? 0], ["Overdue >3w", kpi?.overdue_count ?? 0] ].map(([label, value]) => <div key={String(label)} className="card"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div>)}
      </div>

      <div className="card">
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Lightbulb size={14} /> Insights</p>
        <p className="text-xl font-semibold">Application → Proposal Rate: <span className="text-indigo-600">{conversionRate.toFixed(1)}%</span></p>
        <ul className="mt-3 space-y-1 text-sm text-slate-700">
          <li className="flex items-start gap-2"><ListFilter size={14} className="mt-0.5 text-indigo-500" />{conversionRate < 15 ? "Your application→proposal rate is low. Refine CV versions per role and focus on higher match opportunities." : "Your proposal conversion looks healthy."}</li>
          <li className="flex items-start gap-2"><ChartNoAxesCombined size={14} className="mt-0.5 text-indigo-500" />{(kpi?.overdue_count ?? 0) > 0 ? `You have ${kpi?.overdue_count} overdue applications; follow up to increase interview chances.` : "No overdue follow-ups right now."}</li>
          <li className="flex items-start gap-2"><PieChart size={14} className="mt-0.5 text-indigo-500" />{last < prev ? "Your application volume dropped vs previous period. Aim for consistency this cycle." : "Application volume trend is stable or improving."}</li>
        </ul>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <FunnelChart data={Array.from(statusMap, ([status, count]) => ({ status, count }))} />
        <TrendChart data={trendData} label={`Applications by ${range}`} />
        <PlatformsChart data={Array.from(platformMap, ([platform, count]) => ({ platform, count }))} />
      </div>
    </div>
  );
}
