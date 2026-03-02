import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import OpenAI from "openai";
import { z } from "zod";
import { differenceInDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { inferPlatform, inferWorkMode } from "@/lib/jobs";
import { safeFetchHtml, validateUrlForFetch } from "@/lib/security/import-security";
import { enforceImportRateLimits } from "@/lib/security/rate-limit";

const supportedJobPlatforms = ["linkedin", "indeed", "wellfound", "other"] as const;

const importRequestSchema = z.object({
  url: z.string().trim().url("Invalid URL").max(2000),
  cvText: z.string().trim().max(30000).optional().default(""),
  content: z.string().trim().max(30000).optional().default(""),
  cvFilePath: z.string().trim().max(400).optional().default(""),
  cvVersionName: z.string().trim().max(200).optional().default(""),
  previewOnly: z.boolean().optional().default(false),
  bypassDuplicateCheck: z.boolean().optional().default(false)
});

const aiOutputSchema = z.object({
  bullet_insights: z.array(z.string().max(200)).max(5),
  keywords: z.array(z.string().max(50)).max(30),
  risk_flags: z.array(z.string().max(80)).max(20),
  match_score: z.number().min(0).max(100).optional(),
  clean_job_description: z.string().max(12000).optional(),
  recruitment_timeline: z.array(z.string().max(200)).max(10).optional()
});

function normalizeJobPlatform(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return supportedJobPlatforms.includes(normalized as (typeof supportedJobPlatforms)[number]) ? normalized : null;
}

function extractField(text: string, label: string) {
  const regex = new RegExp(`${label}\\s*[:|-]\\s*([^\\n]+)`, "i");
  return text.match(regex)?.[1]?.trim() ?? null;
}

const safeJsonParse = (value: string | null | undefined) => {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
};

const normalizeDescription = (input: string) =>
  input
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .filter((line, idx, arr) => line && !(idx > 0 && line === arr[idx - 1]))
    .join("\n")
    .slice(0, 12000);

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr
  } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsedBody = importRequestSchema.safeParse(body);
  if (!parsedBody.success) return NextResponse.json({ error: parsedBody.error.issues[0]?.message ?? "Invalid request payload" }, { status: 400 });

  const { url, content, cvText, cvFilePath, cvVersionName, previewOnly, bypassDuplicateCheck } = parsedBody.data;

  if (!content) {
    try {
      await validateUrlForFetch(url);
    } catch {
      return NextResponse.json({ error: "URL is not allowed for import" }, { status: 400 });
    }
  }

  const userIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateLimit = await enforceImportRateLimits(user.id, userIp).catch(() => null);
  if (!rateLimit) return NextResponse.json({ error: "Import unavailable due to server configuration" }, { status: 503 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many import attempts. Please retry shortly.", retryAfter: rateLimit.retryAfter }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } });
  }

  const importId = randomUUID();
  const platform = inferPlatform(url || content);

  if (!previewOnly) {
    const { error: importErr } = await supabase.from("job_imports").insert({ id: importId, user_id: user.id, source_url: url, status: "processing", platform });
    if (importErr) return NextResponse.json({ error: `Failed to create import row: ${importErr.message}` }, { status: 500 });
  }

  try {
    let text = content;
    let title = extractField(content, "Job Title") || "Untitled role";
    let company = extractField(content, "Company") || extractField(content, "Employer") || "Unknown";

    if (!content) {
      const html = await safeFetchHtml(url);
      const dom = new JSDOM(html, { url });
      const article = new Readability(dom.window.document).parse();
      text = article?.textContent ?? dom.window.document.body?.textContent ?? "";
      title = article?.title || dom.window.document.title || extractField(text, "Job Title") || "Untitled role";
      company = extractField(text, "Company") || extractField(text, "Employer") || dom.window.document.querySelector("meta[property='og:site_name']")?.getAttribute("content") || "Unknown";
    }

    const location = extractField(text, "Location") || null;
    const salaryText = extractField(text, "Salary") || null;
    const workMode = inferWorkMode(text);
    const description = normalizeDescription(text || "");

    let aiSummary: Record<string, unknown> = {
      title,
      company,
      location,
      work_mode: workMode,
      platform,
      brief_description: description.slice(0, 400),
      clean_job_description: description,
      bullet_insights: [],
      keywords: [],
      risk_flags: [],
      recruitment_timeline: [],
      match_score: null
    };

    if (process.env.OPENAI_API_KEY && description) {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const extracted = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Extract structured job details and return concise JSON." },
          {
            role: "user",
            content:
              "Return JSON with keys: title, company, location, work_mode(remote|hybrid|on_site|unknown), platform(linkedin|indeed|wellfound|other), brief_description(max 300 chars), clean_job_description(only the job description content), recruitment_timeline(array of interview/recruitment stages if present), keywords(array max 30), bullet_insights(array max 5), risk_flags(array max 20). Input:\n" +
              description
          }
        ]
      });
      const firstValidated = aiOutputSchema.safeParse(safeJsonParse(extracted.choices[0]?.message?.content));
      if (firstValidated.success) aiSummary = { ...aiSummary, ...firstValidated.data };

      if (cvText || cvVersionName || cvFilePath) {
        const cvProfileText = [cvText, cvVersionName ? `CV version: ${cvVersionName}` : "", cvFilePath ? `CV file path: ${cvFilePath}` : ""].filter(Boolean).join("\n");
        const match = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "You are a strict talent reviewer. Return concise JSON only." },
            { role: "user", content: `Given CV profile text and a job description, return JSON with keys: match_score(number from 0 to 100), bullet_insights(array max 5), keywords(array max 30), risk_flags(array max 20).\n\nCV:\n${cvProfileText.slice(0, 8000)}\n\nJOB:\n${description.slice(0, 8000)}` }
          ]
        });
        const secondValidated = aiOutputSchema.safeParse(safeJsonParse(match.choices[0]?.message?.content));
        if (secondValidated.success) aiSummary = { ...aiSummary, ...secondValidated.data };
      }
    }

    const normalizedMatchScore = Number(aiSummary.match_score);
    const safeMatchScore = Number.isFinite(normalizedMatchScore) ? Math.max(0, Math.min(100, Math.round(normalizedMatchScore))) : null;

    const aiWorkMode = ["remote", "hybrid", "on_site"].includes(String(aiSummary.work_mode)) ? aiSummary.work_mode : workMode;

    const { data: possibleDuplicates } = await supabase
      .from("job_applications")
      .select("id,job_title,company_name,applied_at,job_url")
      .eq("user_id", user.id)
      .eq("job_url", url)
      .limit(1);

    const duplicate = possibleDuplicates?.[0] ?? null;
    const duplicateAgeDays = duplicate?.applied_at ? differenceInDays(new Date(), new Date(duplicate.applied_at)) : null;

    if (previewOnly) {
      return NextResponse.json({ ok: true, preview: { title: String(aiSummary.title || title), company: String(aiSummary.company || company), matchScore: safeMatchScore, duplicate, duplicateAgeDays, duplicateOlderThan3Weeks: duplicateAgeDays != null && duplicateAgeDays > 21 } });
    }

    if (duplicate && !bypassDuplicateCheck) {
      return NextResponse.json({ error: "Duplicate detected", duplicate, duplicateAgeDays, duplicateOlderThan3Weeks: duplicateAgeDays != null && duplicateAgeDays > 21 }, { status: 409 });
    }

    const cleanDescription = normalizeDescription(String(aiSummary.clean_job_description || description));
    const { data: createdJob, error: jobErr } = await supabase
      .from("job_applications")
      .insert({
        user_id: user.id,
        job_title: String(aiSummary.title || title),
        company_name: String(aiSummary.company || company),
        status: "applied",
        job_description: cleanDescription,
        brief_description: String(aiSummary.brief_description || cleanDescription.slice(0, 400)),
        job_url: url,
        platform: normalizeJobPlatform(aiSummary.platform) ?? normalizeJobPlatform(platform),
        work_mode: aiWorkMode,
        location: String(aiSummary.location || location || "") || null,
        salary_text: salaryText,
        ai_insights: (Array.isArray(aiSummary.bullet_insights) ? aiSummary.bullet_insights : []).map((x) => `• ${x}`).join("\n") || null,
        ai_insights_json: {
          ...aiSummary,
          recruitment_timeline: Array.isArray(aiSummary.recruitment_timeline) ? aiSummary.recruitment_timeline : [],
          current_timeline_stage: 0,
          match_score: safeMatchScore,
          cv_file_path: cvFilePath || null,
          cv_version_name: cvVersionName || null
        },
        match_score: safeMatchScore,
        cv_file_path: cvFilePath || null,
        applied_at: new Date().toISOString().slice(0, 10)
      })
      .select("id")
      .single();

    if (jobErr) {
      await supabase.from("job_imports").update({ status: "failed", error_message: jobErr.message }).eq("id", importId);
      return NextResponse.json({ error: `Failed to create job application: ${jobErr.message}` }, { status: 500 });
    }

    await supabase.from("job_imports").update({ status: "done", created_job_application_id: createdJob?.id ?? null, extracted_payload: aiSummary }).eq("id", importId);
    return NextResponse.json({ ok: true, jobId: createdJob?.id ?? null });
  } catch (error) {
    if (!previewOnly) await supabase.from("job_imports").update({ status: "failed", error_message: String(error) }).eq("id", importId);
    return NextResponse.json({ error: "Import failed. Please complete manual entry." }, { status: 500 });
  }
}
