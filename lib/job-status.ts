import type { JobStatus } from "@/types/db";

export const jobStatusLabels: Record<JobStatus, string> = {
  not_applied: "Not Applied",
  applied: "Applied",
  proposal: "Proposal",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  no_answer: "No answer",
  withdrawn: "Withdrawn",
};

export const jobStatuses = Object.keys(jobStatusLabels) as JobStatus[];

export function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === "string" && Object.hasOwn(jobStatusLabels, value);
}
