import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import OpenAI from "openai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { inferPlatform, inferWorkMode } from "@/lib/jobs";
import { safeFetchHtml, validateUrlForFetch } from "@/lib/security/import-security";
import { enforceImportRateLimits } from "@/lib/security/rate-limit";

const supportedJobPlatforms = ["linkedin", "indeed", "wellfound", "other"] as const;

const importRequestSchema = z
  .object({
    url: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .default("")
      .refine((value) => !value || z.string().url().safeParse(value).success, "Invalid URL"),
    cvText: z.string().trim().max(30000).optional().default(""),
    content: z.string().trim().max(30000).optional().default(""),
    cvFilePath: z.string().trim().max(400).optional().default(""),
    cvVersionName: z.string().trim().max(200).optional().default("")
  })
  .refine((payload) => payload.url || payload.content, {
    message: "Provide a URL or page content"
  });

const aiOutputSchema = z.object({
  bullet_insights: z.array(z.string().max(200)).max(5),
  keywords: z.array(z.string().max(50)).max(30),
  risk_flags: z.array(z.string().max(80)).max(20),
  match_score: z.number().min(0).max(100).optional()
});

function normalizeJobPlatform(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return supportedJobPlatforms.includes(normalized as (typeof supportedJobPlatforms)[number]) ? normalized : null;
}

function extractField(text: string, label: string) {
  const regex = new RegExp(`${label}\\s*[:|-]\\s*([^\\n]+)`, "i");
  const match = text.match(regex);
  return match?.[1]?.trim() ?? null;
}

const safeJsonParse = (value: string | null | undefined) => {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr
  } = await supabase.auth.getUser();

  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedBody = importRequestSchema.safeParse(body);
  if (!parsedBody.success) return NextResponse.json({ error: parsedBody.error.issues[0]?.message ?? "Invalid request payload" }, { status: 400 });

  const { url, content, cvText, cvFilePath, cvVersionName } = parsedBody.data;

  if (url && !content) {
    try {
      await validateUrlForFetch(url);
    } catch {
      return NextResponse.json({ error: "URL is not allowed for import" }, { status: 400 });
    }
  }

  const userIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  try {
    const rateLimit = await enforceImportRateLimits(user.id, userIp);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many import attempts. Please retry shortly.", retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
      );
    }
  } catch {
    return NextResponse.json({ error: "Import unavailable due to server configuration" }, { status: 503 });
  }

  const importId = randomUUID();
  const platform = inferPlatform(url || content);

  const { error: importErr } = await supabase.from("job_imports").insert({
    id: importId,
    user_id: user.id,
    source_url: url || null,
    status: "processing",
    platform
  });

  if (importErr) return NextResponse.json({ error: `Failed to create import row: ${importErr.message}` }, { status: 500 });

  try {
    let text = content;
    let title = extractField(content, "Job Title") || "Untitled role";
    let company = extractField(content, "Company") || extractField(content, "Employer") || "Unknown";

    if (url && !content) {
      const html = await safeFetchHtml(url);
      const dom = new JSDOM(html, { url });
      const article = new Readability(dom.window.document).parse();
      text = article?.textContent ?? dom.window.document.body?.textContent ?? "";
      title = article?.title || dom.window.document.title || extractField(text, "Job Title") || "Untitled role";
      company =
        extractField(text, "Company") ||
        extractField(text, "Employer") ||
        dom.window.document.querySelector("meta[property='og:site_name']")?.getAttribute("content") ||
        "Unknown";
    }

    const location = extractField(text, "Location") || null;
    const salaryText = extractField(text, "Salary") || null;
    const workMode = inferWorkMode(text);
    const description = (text || "").slice(0, 12000);

    let aiSummary: Record<string, unknown> = {
      title,
      company,
      location,
      work_mode: workMode,
      platform,
      brief_description: description.slice(0, 400),
      bullet_insights: [],
      keywords: [],
      risk_flags: [],
      match_score: null,
      match_summary: ""
    };

    const apiKey = process.env.OPENAI_API_KEY;

    if (apiKey && description) {
      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Extract structured job details and return concise JSON." },
          {
            role: "user",
            content:
              "Return JSON with keys: title, company, location, work_mode(remote|hybrid|on_site|unknown), platform(linkedin|indeed|wellfound|other), brief_description(max 300 chars), keywords(array max 30, each <= 50 chars), bullet_insights(array max 5, each <= 200 chars), risk_flags(array max 20, each <= 80 chars). Input:\n" +
              description
          }
        ]
      });

      const firstResponse = safeJsonParse(completion.choices[0]?.message?.content);
      const firstValidated = aiOutputSchema.safeParse(firstResponse);
      if (firstValidated.success) {
        aiSummary = { ...aiSummary, ...firstResponse };
      }

      const cvProfileText = [cvText, cvVersionName ? `CV version: ${cvVersionName}` : "", cvFilePath ? `CV file path: ${cvFilePath}` : ""]
        .filter(Boolean)
        .join("\n");

      if (cvProfileText) {
        const matchCompletion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "You are a strict talent reviewer. Return concise JSON only."
            },
            {
              role: "user",
              content:
                "Given CV profile text and a job description, return JSON with keys: match_score(number from 0 to 100), bullet_insights(array max 5, each <= 200 chars), keywords(array max 30, each <= 50 chars), risk_flags(array max 20, each <= 80 chars).\n\nCV:\n" +
                cvProfileText.slice(0, 8000) +
                "\n\nJOB:\n" +
                description.slice(0, 8000)
            }
          ]
        });

        const secondResponse = safeJsonParse(matchCompletion.choices[0]?.message?.content);
        const secondValidated = aiOutputSchema.safeParse(secondResponse);
        if (secondValidated.success) aiSummary = { ...aiSummary, ...secondValidated.data };
      }
    }

    const normalizedMatchScore = Number(aiSummary.match_score);
    const safeMatchScore = Number.isFinite(normalizedMatchScore)
      ? Math.max(0, Math.min(100, Math.round(normalizedMatchScore)))
      : null;

    const aiWorkMode = ["remote", "hybrid", "on_site"].includes(String(aiSummary.work_mode)) ? aiSummary.work_mode : workMode;

    const { data: createdJob, error: jobErr } = await supabase
      .from("job_applications")
      .insert({
        user_id: user.id,
        job_title: String(aiSummary.title || title),
        company_name: String(aiSummary.company || company),
        status: "applied",
        job_description: description,
        brief_description: String(aiSummary.brief_description || description.slice(0, 400)),
        job_url: url || null,
        platform: normalizeJobPlatform(aiSummary.platform) ?? normalizeJobPlatform(platform),
        work_mode: aiWorkMode,
        location: String(aiSummary.location || location || "") || null,
        salary_text: salaryText,
        ai_insights: (Array.isArray(aiSummary.bullet_insights) ? aiSummary.bullet_insights : []).map((x) => `• ${x}`).join("\n") || null,
        ai_insights_json: {
          ...aiSummary,
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

    await supabase
      .from("job_imports")
      .update({ status: "done", created_job_application_id: createdJob?.id ?? null, extracted_payload: aiSummary })
      .eq("id", importId);

    return NextResponse.json({ ok: true, jobId: createdJob?.id ?? null });
  } catch (error) {
    await supabase.from("job_imports").update({ status: "failed", error_message: String(error) }).eq("id", importId);
    return NextResponse.json({ error: "Import failed. Please complete manual entry." }, { status: 500 });
  }
}
