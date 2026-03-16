import type { JobFinderResult, JobFinderSearchInput } from "@/lib/job-finder/types";

type RapidApiResponse = { data?: Record<string, unknown>[]; [key: string]: unknown };

const toSafeString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const toNullableString = (value: unknown) => {
  const cleaned = toSafeString(value);
  return cleaned ? cleaned : null;
};
const toNullableNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

function sanitizeUrl(value: unknown) {
  const text = toSafeString(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function buildJobFinderQuery(roleKeywords: string, cvSummary: string, cvSkills: string, location: string, remoteOnly: boolean) {
  const role = roleKeywords.trim();
  const cvTopLine = cvSummary.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
  const firstSkill = cvSkills.split(/[\n,]/).map((line) => line.trim()).find(Boolean) ?? "";
  const targetRole = role || cvTopLine || firstSkill || "Job";

  if (remoteOnly && !location.trim()) return `${targetRole} remote`;
  if (location.trim()) return `${targetRole} in ${location.trim()}`;
  return targetRole;
}

export async function fetchRapidApiJobs(input: JobFinderSearchInput) {
  const apiKey = process.env.RAPIDAPI_KEY;
  const apiHost = process.env.RAPIDAPI_HOST;
  const endpoint = process.env.RAPIDAPI_JOBS_ENDPOINT || "https://jsearch.p.rapidapi.com/search";

  if (!apiKey || !apiHost) {
    throw new Error("RapidAPI configuration missing");
  }

  const queryParams = new URLSearchParams();
  const put = (key: string, value?: string | number | boolean | null) => {
    if (value === undefined || value === null) return;
    const text = String(value).trim();
    if (!text) return;
    queryParams.set(key, text);
  };

  put("query", input.roleKeywords);
  put("page", input.page ?? 1);
  put("num_pages", Math.min(Math.max(input.numPages ?? 1, 1), 5));
  put("country", input.country);
  put("language", input.language);
  put("location", input.location);
  put("date_posted", input.datePosted);
  put("work_from_home", input.remoteOnly ? "true" : undefined);
  put("employment_types", input.employmentTypes?.join(","));
  put("job_requirements", input.jobRequirements?.join(","));
  put("radius", input.radius);
  put("exclude_job_publishers", input.excludeJobPublishers);

  const url = `${endpoint}?${queryParams.toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": apiHost
      },
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`RapidAPI request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as RapidApiResponse;
    return normalizeRapidApiJobs(payload);
  } finally {
    clearTimeout(timer);
  }
}

export function normalizeRapidApiJobs(payload: RapidApiResponse): JobFinderResult[] {
  const rows = Array.isArray(payload.data) ? payload.data : [];

  return rows.map((row, index) => {
    const employmentTypes = Array.isArray(row.job_employment_types)
      ? row.job_employment_types.map((item) => toSafeString(item)).filter(Boolean)
      : [];

    return {
      jobIdExternal: toSafeString(row.job_id) || `row-${index}`,
      jobTitle: toNullableString(row.job_title),
      employerName: toNullableString(row.employer_name),
      employerLogo: sanitizeUrl(row.employer_logo),
      employerWebsite: sanitizeUrl(row.employer_website),
      jobPublisher: toNullableString(row.job_publisher),
      jobEmploymentType: toNullableString(row.job_employment_type),
      jobEmploymentTypes: employmentTypes,
      jobApplyLink: sanitizeUrl(row.job_apply_link),
      jobApplyIsDirect: typeof row.job_apply_is_direct === "boolean" ? row.job_apply_is_direct : null,
      jobGoogleLink: sanitizeUrl(row.job_google_link),
      jobDescription: toNullableString(row.job_description),
      jobIsRemote: typeof row.job_is_remote === "boolean" ? row.job_is_remote : null,
      jobPostedAt: toNullableString(row.job_posted_at),
      jobPostedAtTimestamp: toNullableNumber(row.job_posted_at_timestamp),
      jobPostedAtDatetimeUtc: toNullableString(row.job_posted_at_datetime_utc),
      jobLocation: toNullableString(row.job_location),
      jobCity: toNullableString(row.job_city),
      jobState: toNullableString(row.job_state),
      jobCountry: toNullableString(row.job_country),
      jobLatitude: toNullableNumber(row.job_latitude),
      jobLongitude: toNullableNumber(row.job_longitude),
      jobMinSalary: toNullableNumber(row.job_min_salary),
      jobMaxSalary: toNullableNumber(row.job_max_salary),
      jobSalary: toNullableString(row.job_salary),
      jobSalaryPeriod: toNullableString(row.job_salary_period),
      matchScore: 0,
      matchLabel: "Low",
      rawPayload: row
    };
  });
}
