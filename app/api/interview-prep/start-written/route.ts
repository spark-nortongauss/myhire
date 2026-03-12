import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addInterviewMessage, createWrittenInterviewSession } from "@/lib/interview-prep/data";
import { generateFirstWrittenQuestion } from "@/lib/interview-prep/ai";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { interviewPrepId?: string } | null;
  if (!body?.interviewPrepId) return NextResponse.json({ error: "interviewPrepId is required" }, { status: 400 });

  const { data: prep } = await supabase.from("interview_prep").select("*").eq("id", body.interviewPrepId).eq("user_id", user.id).maybeSingle();
  if (!prep) return NextResponse.json({ error: "Interview prep not found" }, { status: 404 });

  const { data: job } = await supabase
    .from("job_applications")
    .select("job_title,company_name,brief_description,job_description,location,industry,notes")
    .eq("id", prep.job_application_id)
    .eq("user_id", user.id)
    .maybeSingle();

  const session = await createWrittenInterviewSession(supabase, user.id, prep.id, prep.job_application_id);
  if (!session) return NextResponse.json({ error: "Could not create session" }, { status: 500 });

  const firstQuestion = await generateFirstWrittenQuestion({
    job_title: job?.job_title,
    company_name: job?.company_name,
    brief_description: job?.brief_description,
    job_description: job?.job_description,
    location: job?.location,
    industry: job?.industry,
    notes: job?.notes,
    interview_stage: prep.interview_stage,
    interview_type: prep.interview_type
  });

  if (!firstQuestion) {
    return NextResponse.json({ error: "AI generation unavailable. Please retry." }, { status: 503 });
  }

  await addInterviewMessage(supabase, session.id, { role: "assistant", question_text: firstQuestion, score: 0 });
  await supabase.from("interview_prep").update({ last_session_at: new Date().toISOString() }).eq("id", prep.id).eq("user_id", user.id);

  return NextResponse.json({ ok: true, sessionId: session.id, firstQuestion });
}
