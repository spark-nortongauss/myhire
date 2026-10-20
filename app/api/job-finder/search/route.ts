import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { computeJobMatch } from "@/lib/job-finder/match";
import { buildJobFinderQuery, fetchRapidApiJobs } from "@/lib/job-finder/rapidapi";
import { JOB_FINDER_DATE_POSTED, JOB_FINDER_EMPLOYMENT_TYPES, JOB_FINDER_REQUIREMENTS } from "@/lib/job-finder/types";

const bodySchema = z.object({
  cvId: z.string().uuid(),
  roleKeywords: z.string().min(2).max(240),
  country: z.string().trim().toUpperCase().length(2).optional().or(z.literal("")),
  language: z.string().trim().toUpperCase().min(2).max(5).optional().or(z.literal("")),
  location: z.string().trim().max(120).optional(),
  remoteOnly: z.boolean().optional(),
  datePosted: z.enum(JOB_FINDER_DATE_POSTED).default("all"),
  employmentTypes: z.array(z.enum(JOB_FINDER_EMPLOYMENT_TYPES)).default([]),
  jobRequirements: z.array(z.enum(JOB_FINDER_REQUIREMENTS)).default([]),
  radius: z.number().int().min(0).max(500).optional(),
  excludeJobPublishers: z.string().trim().max(300).optional(),
  page: z.number().int().min(1).max(20).default(1),
  numPages: z.number().int().min(1).max(5).default(1)
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawBody = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });

  const body = parsed.data;
  const { data: cv, error: cvError } = await supabase.from("user_cvs").select("parsed_text,parsed_skills").eq("id", body.cvId).eq("user_id", user.id).maybeSingle();
  if (cvError || !cv) return NextResponse.json({ error: "CV profile not found in your account." }, { status: 404 });
  if (!process.env.RAPIDAPI_KEY || !process.env.RAPIDAPI_HOST) return NextResponse.json({ error: "Job search provider is not configured." }, { status: 503 });
  const cvSummary = cv.parsed_text ?? "";
  const cvSkills = (cv.parsed_skills ?? []).join(", ");
  const finalQuery = buildJobFinderQuery(body.roleKeywords, cvSummary, cvSkills, body.location ?? "", Boolean(body.remoteOnly));

  const { data: searchRow, error: searchError } = await supabase
    .from("job_finder_searches")
    .insert({
      user_id: user.id,
      cv_id: body.cvId,
      keywords: body.roleKeywords,
      generated_query: finalQuery,
      status: "processing",
      country: body.country || null,
      language: body.language || null,
      location: body.location || null,
      remote_only: Boolean(body.remoteOnly),
      date_posted: body.datePosted,
      employment_types: body.employmentTypes,
      job_requirements: body.jobRequirements,
      radius: body.radius ?? null,
      exclude_job_publishers: (body.excludeJobPublishers || "").split(",").map((item) => item.trim()).filter(Boolean),
      page: body.page,
      num_pages: body.numPages,
      total_results: 0
    })
    .select("id")
    .single();

  if (searchError || !searchRow?.id) {
    console.error("job-finder search insert failed", { code: searchError?.code, message: searchError?.message });
    return NextResponse.json({ error: "Could not save search" }, { status: 500 });
  }

  try {
    const results = await fetchRapidApiJobs({
      ...body,
      roleKeywords: finalQuery
    });

    const scored = results.map((job) => {
      const match = computeJobMatch(cvSummary, cvSkills, { jobTitle: job.jobTitle, jobDescription: job.jobDescription });
      return { ...job, matchScore: match.score, matchLabel: match.label };
    });

    if (scored.length) {
      const { error: resultsError } = await supabase.from("job_finder_results").upsert(
        scored.map((job) => ({
          user_id: user.id,
          search_id: searchRow.id,
          job_id_external: job.jobIdExternal,
          job_title: job.jobTitle,
          employer_name: job.employerName,
          employer_logo: job.employerLogo,
          employer_website: job.employerWebsite,
          job_publisher: job.jobPublisher,
          job_employment_type: job.jobEmploymentType,
          job_employment_types: job.jobEmploymentTypes,
          job_apply_link: job.jobApplyLink,
          job_apply_is_direct: job.jobApplyIsDirect,
          job_google_link: job.jobGoogleLink,
          job_description: job.jobDescription,
          job_is_remote: job.jobIsRemote,
          job_posted_at: job.jobPostedAt,
          job_posted_at_timestamp: job.jobPostedAtTimestamp,
          job_posted_at_datetime_utc: job.jobPostedAtDatetimeUtc,
          job_location: job.jobLocation,
          job_city: job.jobCity,
          job_state: job.jobState,
          job_country: job.jobCountry,
          job_latitude: job.jobLatitude,
          job_longitude: job.jobLongitude,
          job_min_salary: job.jobMinSalary,
          job_max_salary: job.jobMaxSalary,
          job_salary: job.jobSalary,
          job_salary_period: job.jobSalaryPeriod,
          match_score: job.matchScore,
          raw_payload: job.rawPayload
        })),
        { onConflict: "search_id,job_id_external" }
      );

      if (resultsError) {
        console.error("job-finder results upsert failed", { code: resultsError.code, message: resultsError.message });
        throw new Error("Could not save results");
      }
    }

    const { error: completionError } = await supabase.from("job_finder_searches").update({ status: "completed", error: null, total_results: scored.length, updated_at: new Date().toISOString() }).eq("id", searchRow.id).eq("user_id", user.id);
    if (completionError) throw new Error("Could not complete search");

    return NextResponse.json({ searchId: searchRow.id, totalResults: scored.length });
  } catch (error) {
    await supabase.from("job_finder_searches").update({ status: "failed", error: "Search failed. Please retry." }).eq("id", searchRow.id).eq("user_id", user.id);
    console.error("job-finder api failed", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "Job search failed. Please try again." }, { status: 502 });
  }
}
