export const INTERVIEWER_OPTIONS = [
  "1st Call",
  "Recruiter",
  "HR Manager",
  "Hiring Manager",
  "CTO",
  "CEO",
  "COO",
  "Sales Director",
  "Operations Director",
  "Technical Manager",
  "Team Lead",
  "Peer / Colleague",
  "Panel Interview",
  "Meet the Team",
  "Founder",
  "VP Engineering",
  "VP Operations",
  "Other"
] as const;

export type InterviewerOption = (typeof INTERVIEWER_OPTIONS)[number];

export const MAX_INTERVIEWERS = 3;
export const MIN_INTERVIEWERS = 1;

export function normalizeInterviewerSelection(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index);
  return normalized;
}

export function validateInterviewerSelection(value: unknown): { valid: boolean; message?: string; selected: string[] } {
  const selected = normalizeInterviewerSelection(value);

  if (selected.length < MIN_INTERVIEWERS) {
    return { valid: false, message: "At least 1 interviewer is required.", selected };
  }

  if (selected.length > MAX_INTERVIEWERS) {
    return { valid: false, message: "You can select up to 3 interviewer profiles.", selected };
  }

  const invalid = selected.find((item) => !INTERVIEWER_OPTIONS.includes(item as InterviewerOption));
  if (invalid) {
    return { valid: false, message: `Invalid interviewer option: ${invalid}`, selected };
  }

  return { valid: true, selected };
}

export function includesMeetTheTeam(selected: string[] | null | undefined): boolean {
  if (!selected?.length) return false;
  return selected.includes("Meet the Team");
}
