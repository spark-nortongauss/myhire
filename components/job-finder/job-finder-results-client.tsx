"use client";

import { ExternalLink, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

type SearchRow = {
  id: string;
  query: string;
  country: string | null;
  language: string | null;
  location: string | null;
  remote_only: boolean | null;
  date_posted: string | null;
  employment_types: string[] | null;
  job_requirements: string[] | null;
  total_results: number | null;
};

type ResultRow = {
  id: string;
  job_title: string | null;
  employer_name: string | null;
  employer_logo: string | null;
  job_publisher: string | null;
  job_employment_type: string | null;
  job_is_remote: boolean | null;
  job_location: string | null;
  job_posted_at: string | null;
  job_salary: string | null;
  job_description: string | null;
  job_apply_link: string | null;
  job_google_link: string | null;
  match_score: number | null;
};

function toSafeExternalUrl(primary: string | null, fallback: string | null) {
  const candidate = primary || fallback;
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function JobFinderResultsClient({ search, results }: { search: SearchRow; results: ResultRow[] }) {
  if (!results.length) return <EmptyState title="No matching jobs found" description="Try broadening keywords, country, or date filters." />;

  return (
    <div className="space-y-4">
      <div className="card">
        <h1 className="flex items-center gap-2 text-2xl font-black"><Search size={20} />Job Finder Results</h1>
        <p className="mt-2 text-sm text-muted-foreground">{search.total_results ?? results.length} opportunities saved for query: <span className="font-semibold">{search.query}</span></p>
        <p className="mt-2 text-xs text-muted-foreground">Filters: {search.country || "-"} · {search.language || "-"} · {search.location || "Any location"} · {search.remote_only ? "Remote only" : "All work modes"} · {search.date_posted || "all"}</p>
      </div>

      <div className="grid gap-3">
        {results.map((job) => {
          const openUrl = toSafeExternalUrl(job.job_apply_link, job.job_google_link);
          const score = job.match_score ?? 0;
          const matchTone = score >= 65 ? "Strong" : score >= 35 ? "Medium" : "Low";

          return (
            <article key={job.id} className="card grid gap-2 md:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  {job.employer_logo ? <img src={job.employer_logo} alt="Employer logo" className="h-10 w-10 rounded-md border object-contain" /> : <div className="h-10 w-10 rounded-md border bg-muted" />}
                  <div>
                    <h2 className="text-lg font-semibold">{job.job_title || "Untitled role"}</h2>
                    <p className="text-sm text-muted-foreground">{job.employer_name || "Unknown employer"} · {job.job_publisher || "Unknown publisher"}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{job.job_employment_type || "N/A"} {job.job_is_remote ? "· Remote" : ""}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={12} />{job.job_location || "Location not provided"}</p>
                <p className="text-xs text-muted-foreground">Posted: {job.job_posted_at || "Unknown"} · Salary: {job.job_salary || "Not listed"}</p>
                <p className="line-clamp-3 text-sm text-slate-700">{(job.job_description || "No description provided").slice(0, 280)}</p>
                <p className="text-xs font-semibold">Match: {score}% ({matchTone})</p>
              </div>
              <div className="flex items-start justify-end">
                {openUrl ? <a href={openUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white"><ExternalLink size={14} />See/Open</a> : <Button disabled>Link unavailable</Button>}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
