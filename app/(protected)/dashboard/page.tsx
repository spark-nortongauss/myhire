import { format, startOfDay, startOfMonth, startOfQuarter, startOfWeek } from "date-fns";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BriefcaseBusiness } from "lucide-react";
import { enforceOverdueRejections } from "@/lib/actions/overdue";
import { createClient } from "@/lib/supabase/server";
import { FunnelChart, PlatformsChart, TrendChart, WeeklyTrendMini } from "@/components/dashboard/charts";

const ranges = ["day", "week", "month", "quarter"] as const;
type Range = (typeof ranges)[number];

const getBucketDate = (date: Date, range: Range) => {
  if (range === "day") return startOfDay(date);
  if (range === "week") return startOfWeek(date, { weekStartsOn: 1 });
  if (range === "month") return startOfMonth(date);
  return startOfQuarter(date);
};

const getBucketLabel = (date: Date, range: Range) => {
  if (range === "day") return format(date, "MMM d");
  if (range === "week") return format(date, "MMM d");
  if (range === "month") return format(date, "MMM yyyy");
  return format(date, "QQQ yyyy");
};

export default async function DashboardPage({ searchParams }: { searchParams?: { range?: string } }) {
  await enforceOverdueRejections();
  const range = ranges.includes(searchParams?.range as Range) ? (searchParams?.range as Range) : "week";
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const { data: kpi } = await supabase.from("v_user_kpis").select("*").eq("user_id", user!.id).maybeSingle();
  const { data: jobs } = await supabase.from("v_job_applications_enriched").select("status, platform, applied_at").eq("user_id", user!.id);

  const statusMap = new Map<string, number>();
  const platformMap = new Map<string, number>();
  const periodMap = new Map<string, { date: Date; count: number }>();

  for (const row of jobs ?? []) {
    statusMap.set(row.status, (statusMap.get(row.status) ?? 0) + 1);
    if (row.platform) platformMap.set(row.platform, (platformMap.get(row.platform) ?? 0) + 1);
    if (!row.applied_at) continue;
    const appliedDate = new Date(row.applied_at);
    const bucketDate = getBucketDate(appliedDate, range);
    const key = bucketDate.toISOString();
    const found = periodMap.get(key);
    periodMap.set(key, { date: bucketDate, count: (found?.count ?? 0) + 1 });
  }

  const trendData = Array.from(periodMap.values())
    .sort((left, right) => left.date.getTime() - right.date.getTime())
    .map((item) => ({ period: getBucketLabel(item.date, range), count: item.count }));

  const nowBucket = getBucketDate(new Date(), range).getTime();
  const currentPeriodCount = Array.from(periodMap.values()).find((item) => item.date.getTime() === nowBucket)?.count ?? 0;

  const last = trendData.at(-1)?.count ?? 0;
  const prev = trendData.at(-2)?.count ?? 0;
  const trendIcon = last > prev ? ArrowUpRight : last < prev ? ArrowDownRight : ArrowRight;
  const trendLabel = last > prev ? "Up" : last < prev ? "Down" : "Stable";
  const TrendIcon = trendIcon;

  const conversionRate = Number(kpi?.app_to_proposal_rate ?? 0);
  const insights = [
    conversionRate < 15
      ? "Your application→proposal rate is low. Refine CV versions per role and focus on higher match opportunities."
      : "Your proposal conversion looks healthy.",
    (kpi?.overdue_count ?? 0) > 0
      ? `You have ${kpi?.overdue_count} overdue applications; follow up to increase interview chances.`
      : "No overdue follow-ups right now.",
    last < prev ? "Your application volume dropped vs previous period. Aim for consistency this cycle." : "Application volume trend is stable or improving."
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex flex-wrap gap-2">
          {ranges.map((item) => (
            <Link key={item} href={`/dashboard?range=${item}`} className={`rounded px-3 py-1 text-sm ${range === item ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}`}>
              {item}
            </Link>
          ))}
        </div>
      </div>
      <div className="card flex items-center justify-between border-indigo-100">
        <div>
          <p className="text-sm text-muted-foreground">Applications in current {range}</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-bold">
            <BriefcaseBusiness size={20} className="text-indigo-500" />
            {currentPeriodCount}
          </p>
          <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
            <TrendIcon size={14} className="text-indigo-500" /> {trendLabel} vs previous ({prev})
          </p>
        </div>
        <WeeklyTrendMini data={trendData} />
      </div>
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
        <p className="text-xl font-semibold">{conversionRate.toFixed(1)}%</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {insights.map((insight) => (
            <li key={insight}>{insight}</li>
          ))}
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
