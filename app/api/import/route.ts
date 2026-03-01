import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { inferPlatform, inferWorkMode } from "@/lib/jobs";

const supportedJobPlatforms = ["linkedin", "indeed", "wellfound", "other"] as const;

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

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr
  } = await supabase.auth.getUser();

  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = (body?.url ?? "").toString().trim();
  const content = (body?.content ?? "").toString().trim();
  const cvText = (body?.cvText ?? "").toString().trim();
  const cvFilePath = (body?.cvFilePath ?? "").toString().trim();
  const cvVersionName = (body?.cvVersionName ?? "").toString().trim();
  if (!url && !content) return NextResponse.json({ error: "Provide a URL or page content" }, { status: 400 });

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
      const html = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 MyHireBot/1.0" } }).then((r) => r.text());
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

    let aiSummary = {
      title,
      company,
      location,
      work_mode: workMode,
      platform,
      brief_description: description.slice(0, 400),
      keywords: [] as string[],
      match_score: null as number | null,
      match_summary: ""
    };

    const userApiKey = user.user_metadata?.openai_api_key as string | undefined;
    const apiKey = userApiKey || process.env.OPENAI_API_KEY;

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
              "Return JSON with keys: title, company, location, work_mode(remote|hybrid|on_site|unknown), platform(linkedin|indeed|wellfound|other), brief_description(max 300 chars), keywords(array). Input:\n" +
              description
          }
        ]
      });

      aiSummary = { ...aiSummary, ...JSON.parse(completion.choices[0]?.message?.content || "{}") };

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
                "Given CV profile text and a job description, return JSON with keys: match_score(number from 0 to 100), match_summary(max 280 chars), strengths(array max 4), gaps(array max 4).\n\nCV:\n" +
                cvProfileText.slice(0, 8000) +
                "\n\nJOB:\n" +
                description.slice(0, 8000)
            }
          ]
        });

        aiSummary = { ...aiSummary, ...JSON.parse(matchCompletion.choices[0]?.message?.content || "{}") };
      }
    }

    const normalizedMatchScore = Number(aiSummary.match_score);
    const safeMatchScore = Number.isFinite(normalizedMatchScore)
      ? Math.max(0, Math.min(100, Math.round(normalizedMatchScore)))
      : null;

    const aiWorkMode = ["remote", "hybrid", "on_site"].includes(String(aiSummary.work_mode))
      ? aiSummary.work_mode
      : workMode;

    const { data: createdJob, error: jobErr } = await supabase
      .from("job_applications")
      .insert({
        user_id: user.id,
        job_title: aiSummary.title || title,
        company_name: aiSummary.company || company,
        status: "applied",
        job_description: description,
        brief_description: aiSummary.brief_description || description.slice(0, 400),
        job_url: url || null,
        platform: normalizeJobPlatform(aiSummary.platform) ?? normalizeJobPlatform(platform),
        work_mode: aiWorkMode,
        location: aiSummary.location || location,
        salary_text: salaryText,
        ai_insights: (aiSummary.keywords || []).map((x: string) => `• ${x}`).join("\n") || null,
        ai_insights_json: {
          ...aiSummary,
          match_score: safeMatchScore,
          cv_file_path: cvFilePath || null,
          cv_version_name: cvVersionName || null
        },
        match_score: safeMatchScore,
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
