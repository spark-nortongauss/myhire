import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = z.object({ jobId: z.string().uuid(), cvId: z.string().uuid().nullable().optional() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const body = parsed.data;

  const { data: job } = await supabase.from("job_applications").select("id,job_title,company_name,job_description,ai_insights_json").eq("id", body.jobId).eq("user_id", user.id).maybeSingle();
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OpenAI key missing" }, { status: 503 });

  const cvId = body.cvId !== undefined ? body.cvId : job.ai_insights_json?.cv_version_id;
  let cvText = "";
  if (cvId) {
    const { data: cv } = await supabase.from("user_cvs").select("parsed_text,parsed_skills").eq("id", cvId).eq("user_id", user.id).maybeSingle();
    if (!cv) return NextResponse.json({ error: "CV profile not found. Select a saved CV in the cover letter generator." }, { status: 404 });
    cvText = `${cv.parsed_text ?? ""}\n${(cv.parsed_skills ?? []).join(", ")}`;
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Write a concise, professional and customized cover letter in plain text." },
      { role: "user", content: `Generate a custom cover letter for ${job.job_title} at ${job.company_name}. Use this CV profile:\n${cvText.slice(0, 8000)}\n\nAnd this job description:\n${(job.job_description || "").slice(0, 9000)}` }
    ]
  });

  const letter = completion.choices[0]?.message?.content?.trim();
  if (!letter) return NextResponse.json({ error: "Could not generate cover letter" }, { status: 500 });

  const { error: saveError } = await supabase.from("job_applications").update({ ai_insights_json: { ...(job.ai_insights_json ?? {}), cover_letter_draft: letter } }).eq("id", job.id).eq("user_id", user.id);
  if (saveError) return NextResponse.json({ error: "Could not save generated letter" }, { status: 500 });
  return NextResponse.json({ ok: true, letter });
}
