export const JOB_FINDER_EMPLOYMENT_TYPES = ["FULLTIME", "CONTRACTOR", "PARTTIME", "INTERN"] as const;
export const JOB_FINDER_REQUIREMENTS = ["under_3_years_experience", "more_than_3_years_experience", "no_experience", "no_degree"] as const;
export const JOB_FINDER_DATE_POSTED = ["all", "today", "3days", "week", "month"] as const;

export type JobFinderEmploymentType = (typeof JOB_FINDER_EMPLOYMENT_TYPES)[number];
export type JobFinderRequirement = (typeof JOB_FINDER_REQUIREMENTS)[number];
export type JobFinderDatePosted = (typeof JOB_FINDER_DATE_POSTED)[number];

export type JobFinderSearchInput = {
  cvId: string;
  cvName?: string;
  cvSummary?: string;
  cvSkills?: string;
  roleKeywords: string;
  country?: string;
  language?: string;
  location?: string;
  remoteOnly?: boolean;
  datePosted?: JobFinderDatePosted;
  employmentTypes?: JobFinderEmploymentType[];
  jobRequirements?: JobFinderRequirement[];
  radius?: number;
  excludeJobPublishers?: string;
  page?: number;
  numPages?: number;
};

export type JobFinderResult = {
  jobIdExternal: string;
  jobTitle: string | null;
  employerName: string | null;
  employerLogo: string | null;
  employerWebsite: string | null;
  jobPublisher: string | null;
  jobEmploymentType: string | null;
  jobEmploymentTypes: string[];
  jobApplyLink: string | null;
  jobApplyIsDirect: boolean | null;
  jobGoogleLink: string | null;
  jobDescription: string | null;
  jobIsRemote: boolean | null;
  jobPostedAt: string | null;
  jobPostedAtTimestamp: number | null;
  jobPostedAtDatetimeUtc: string | null;
  jobLocation: string | null;
  jobCity: string | null;
  jobState: string | null;
  jobCountry: string | null;
  jobLatitude: number | null;
  jobLongitude: number | null;
  jobMinSalary: number | null;
  jobMaxSalary: number | null;
  jobSalary: string | null;
  jobSalaryPeriod: string | null;
  matchScore: number;
  matchLabel: "Strong" | "Medium" | "Low";
  rawPayload: Record<string, unknown>;
};
