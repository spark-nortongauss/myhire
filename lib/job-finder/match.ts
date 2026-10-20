import type { JobFinderResult } from "@/lib/job-finder/types";

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((item) => item.length > 2);

export function computeJobMatch(cvSummary: string, cvSkills: string, job: Pick<JobFinderResult, "jobTitle" | "jobDescription">) {
  const cvTokens = new Set([...tokenize(cvSummary), ...tokenize(cvSkills)]);
  if (cvTokens.size === 0) return { score: 0, label: "Low" as const };

  const jobTokens = new Set([...tokenize(job.jobTitle ?? ""), ...tokenize(job.jobDescription ?? "")]);
  const overlap = [...cvTokens].filter((token) => jobTokens.has(token)).length;
  const score = Math.max(0, Math.min(100, Math.round((overlap / Math.max(cvTokens.size, 1)) * 100)));

  if (score >= 80) return { score, label: "Strong" as const };
  if (score >= 55) return { score, label: "Medium" as const };
  return { score, label: "Low" as const };
}
