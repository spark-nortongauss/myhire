// app/api/import/route.ts
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
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

  // 1) Auth
  const {
    data: { user },
    error: userErr
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Input
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = (body?.url ?? "").toString().trim();
  if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });

  // 3) Create import row with guaranteed ID (fixes: importRow possibly null)
  const importId = randomUUID();

  const { error: importErr } = await supabase.from("job_imports").insert({
    id: importId,
    user_id: user.id,
    source_url: url,
    status: "processing",
    platform: inferPlatform(url) // if your table has this column; if not, remove this line
  });

  if (importErr) {
    return NextResponse.json(
      { error: `Failed to create import row: ${importErr.message}` },
      { status: 500 }
    );
  }

  try {
    // 4) Fetch + extract readable text
    const html = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 MyHireBot/1.0" }
    }).then((r) => r.text());

    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();
    const text =
      article?.textContent ??
      dom.window.document.body?.textContent ??
      "";

    const title =
      article?.title ||
      dom.window.document.title ||
      extractField(text, "Job Title") ||
      "Untitled role";

    const company =
      extractField(text, "Company") ||
      extractField(text, "Employer") ||
      dom.window.document
        .querySelector("meta[property='og:site_name']")
        ?.getAttribute("content") ||
      "Unknown";

    const location = extractField(text, "Location") || null;
    const salaryText = extractField(text, "Salary") || null;

    const workMode = inferWorkMode(text);
    const platform = inferPlatform(url);
    const description = (text || "").slice(0, 12000);

    // 5) Optional AI insights
    let ai_insights = "(AI disabled: no key)";
    let ai_insights_json: any = null;

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
      ai_insights = (ai_insights_json.bullet_insights ?? [])
        .map((x: string) => `• ${x}`)
        .join("\n");
    }

    // 6) Create job application row
    const { data: createdJob, error: jobErr } = await supabase
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
        // If your column type is DATE, prefer YYYY-MM-DD:
        applied_at: new Date().toISOString().slice(0, 10)
      })
      .select("id")
      .single();

    if (jobErr) {
      // Update import row to failed and return
      await supabase
        .from("job_imports")
        .update({ status: "failed", error_message: jobErr.message })
        .eq("id", importId);

      return NextResponse.json(
        { error: `Failed to create job application: ${jobErr.message}` },
        { status: 500 }
      );
    }

    // 7) Update import row to done (use importId, not importRow.id)
    const { error: updErr } = await supabase
      .from("job_imports")
      .update({
        status: "done",
        created_job_application_id: createdJob?.id ?? null,
        extracted_payload: { title, company, location, salaryText }
      })
      .eq("id", importId);

    if (updErr) {
      // Not fatal, but good to report
      return NextResponse.json(
        {
          ok: true,
          jobId: createdJob?.id ?? null,
          warning: `Import created but failed to update import row: ${updErr.message}`
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: true, jobId: createdJob?.id ?? null });
  } catch (error) {
    await supabase
      .from("job_imports")
      .update({ status: "failed", error_message: String(error) })
      .eq("id", importId);

    return NextResponse.json(
      {
        error:
          "Import failed. Some websites block automated extraction. Please copy details manually in the Add Job form."
      },
      { status: 500 }
    );
  }
}
