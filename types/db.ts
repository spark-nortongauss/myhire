export type JobStatus =
  | "applied"
  | "proposal"
  | "interview"
  | "offer"
  | "rejected"
  | "no_answer";

export type Platform = "linkedin" | "indeed" | "wellfound" | "other";
export type WorkMode = "remote" | "hybrid" | "on_site";

export interface JobApplication {
  id: string;
  user_id: string;
  job_title: string;
  company_name: string;
  status: JobStatus;
  brief_description: string | null;
  salary_text: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  work_mode: WorkMode | null;
  platform: Platform | null;
  ai_insights: string | null;
  ai_insights_json: Record<string, unknown> | null;
  industry: string | null;
  applied_at: string | null;
  notes: string | null;
  cv_file_path: string | null;
  cover_letter_file_path: string | null;
  job_url: string | null;
  job_description: string | null;
  location: string | null;
  last_activity_at: string | null;
  status_updated_at: string | null;
}
