import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";

const statusTone: Record<string, string> = {
  applied: "bg-blue-100 text-blue-700",
  proposal: "bg-violet-100 text-violet-700",
  interview: "bg-amber-100 text-amber-700",
  offer: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  no_answer: "bg-slate-200 text-slate-700"
};

const getRelativeDaysLabel = (days?: number | null, isOverdue?: boolean | null) => {
  if (days == null) return "Applied date not available";
  if (days === 0) return "Applied today";
  if (days === 1) return "Applied yesterday";
  return `${days} days since applying${isOverdue ? " • follow up recommended" : ""}`;
};

const toLabel = (value?: string | null) => {
  if (!value) return "Not specified";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

const getMatchScore = (data: any) => {
  const parsed = Number(data?.ai_insights_json?.match_score ?? data?.match_score ?? Number.NaN);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, Math.min(100, Math.round(parsed)));
};

export default async function JobDetailsPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data } = await supabase.from("v_job_applications_enriched").select("*").eq("id", params.id).eq("user_id", user!.id).maybeSingle();

  if (!data) return notFound();
  const matchScore = getMatchScore(data);

  const summaryItems = [
    { label: "Platform", value: toLabel(data.platform) },
    { label: "Work mode", value: toLabel(data.work_mode) },
    { label: "Industry", value: data.industry || "Not specified" },
    { label: "Location", value: data.location || "Not specified" },
    { label: "Last update", value: data.status_updated_at ? new Date(data.status_updated_at).toLocaleDateString() : "Not updated yet" },
    { label: "Applied", value: data.applied_at ? new Date(data.applied_at).toLocaleDateString() : "Not set" },
    { label: "CV version", value: data.ai_insights_json?.cv_version_name || "Default CV" }
  ];

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden p-0">
        <div className="bg-grid relative border-b border-border px-6 py-8">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-sky-500/10 to-violet-500/10" />
          <div className="relative space-y-4">
            <Link href="/jobs" className="text-sm font-medium text-indigo-700 hover:underline">
              ← Back to jobs
            </Link>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{data.company_name}</p>
                <h1 className="text-3xl font-bold tracking-tight">{data.job_title}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{getRelativeDaysLabel(data.days_since_applied, data.is_overdue)}</p>
              </div>
              <Badge className={statusTone[data.status] ?? "bg-muted"}>{toLabel(data.status)}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className={matchScore != null && matchScore >= 75 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                AI profile match: {matchScore == null ? "Not scored" : `${matchScore}%`}
              </Badge>
              {data.job_url ? (
                <a href={data.job_url} target="_blank" rel="noreferrer" className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white">
                  Open original listing
                </a>
              ) : null}
              {data.cv_file_path ? (
                <Badge className="bg-emerald-100 text-emerald-700">CV uploaded</Badge>
              ) : (
                <Badge className="bg-slate-100 text-slate-700">CV not uploaded</Badge>
              )}
              {data.cover_letter_file_path ? (
                <Badge className="bg-cyan-100 text-cyan-700">Cover letter uploaded</Badge>
              ) : (
                <Badge className="bg-slate-100 text-slate-700">Cover letter not uploaded</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {summaryItems.map((item) => (
          <div key={item.label} className="card">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
            <p className="mt-2 text-sm font-medium">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="card xl:col-span-2">
          <h2 className="mb-3 text-lg font-semibold">Job description</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{data.job_description || data.brief_description || "No description added yet."}</p>
        </div>
        <div className="card">
          <h2 className="mb-3 text-lg font-semibold">Compensation snapshot</h2>
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Range:</span> {data.salary_text || "Not provided"}
            </p>
            <p>
              <span className="font-medium">Minimum:</span> {data.salary_min ?? "-"}
            </p>
            <p>
              <span className="font-medium">Maximum:</span> {data.salary_max ?? "-"}
            </p>
            <p>
              <span className="font-medium">Currency:</span> {data.salary_currency || "-"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-lg font-semibold">AI insights</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{data.ai_insights || "No AI insights generated yet."}</p>
        </div>
        <div className="card">
          <h2 className="mb-3 text-lg font-semibold">Private notes</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{data.notes || "No personal notes for this application yet."}</p>
        </div>
      </div>
    </div>
  );
}
