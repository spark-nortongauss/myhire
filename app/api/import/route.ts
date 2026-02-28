import { NextResponse } from "next/server";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { inferPlatform, inferWorkMode } from "@/lib/jobs";

function extractField(text: string, label: string) {
  const regex = new RegExp(`${label}\\s*[:|-]\\s*([^\\n]+)`, "i");
  const match = text.match(regex);
  return match?.[1]?.trim() ?? null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url } = await request.json();
  if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });

  const { data: importRow } = await supabase
    .from("job_imports")
    .insert({ user_id: user.id, source_url: url, status: "processing" })
    .select("id")
    .single();

  try {
    const html = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 MyHireBot/1.0" } }).then((r) => r.text());
    const doc = new JSDOM(html, { url });
    const article = new Readability(doc.window.document).parse();
    const text = article?.textContent ?? doc.window.document.body.textContent ?? "";

    const title = article?.title || doc.window.document.title || extractField(text, "Job Title") || "Untitled role";
    const company =
      extractField(text, "Company") || extractField(text, "Employer") || doc.window.document.querySelector("meta[property='og:site_name']")?.getAttribute("content") || "Unknown";
    const location = extractField(text, "Location") || null;
    const salaryText = extractField(text, "Salary") || null;
    const workMode = inferWorkMode(text);
    const platform = inferPlatform(url);
    const description = text.slice(0, 12000);

    let ai_insights = "(AI disabled: no key)";
    let ai_insights_json = null;

    if (process.env.OPENAI_API_KEY) {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You analyze job descriptions and output JSON." },
          {
            role: "user",
            content:
              "Create JSON with keys: bullet_insights (array of 5 strings), keywords (array), risk_flags (array). Job description:\n" +
              description
          }
        ]
      });
      ai_insights_json = JSON.parse(completion.choices[0]?.message?.content || "{}");
      ai_insights = (ai_insights_json.bullet_insights ?? []).map((x: string) => `• ${x}`).join("\n");
    }

    const { data: createdJob } = await supabase
      .from("job_applications")
      .insert({
        user_id: user.id,
        job_title: title,
        company_name: company,
        status: "applied",
        job_description: description,
        brief_description: description.slice(0, 400),
        job_url: url,
        platform,
        work_mode: workMode,
        location,
        salary_text: salaryText,
        ai_insights,
        ai_insights_json,
        applied_at: new Date().toISOString()
      })
      .select("id")
      .single();

    await supabase
      .from("job_imports")
      .update({ status: "done", created_job_application_id: createdJob?.id, extracted_payload: { title, company, location, salaryText } })
      .eq("id", importRow.id);

    return NextResponse.json({ ok: true, jobId: createdJob?.id });
  } catch (error) {
    await supabase.from("job_imports").update({ status: "failed", error_message: String(error) }).eq("id", importRow?.id);
    return NextResponse.json(
      {
        error:
          "Import failed. Some websites block automated extraction. Please copy details manually in the Add Job form."
      },
      { status: 500 }
    );
  }
}
