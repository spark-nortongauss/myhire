import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateInterviewPrepContent } from "@/lib/interview-prep/ai";

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

  const generated = await generateInterviewPrepContent({
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

  if (!generated) return NextResponse.json({ error: "AI generation unavailable. Please retry." }, { status: 503 });

  const { error } = await supabase
    .from("interview_prep")
    .update({
      key_skills_extracted: generated.key_skills_extracted,
      recommended_questions: generated.recommended_questions,
      prep_tips: generated.prep_tips,
      suggested_questions_to_ask: generated.suggested_questions_to_ask,
      prep_status: "in_preparation"
    })
    .eq("id", prep.id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, generated });
}
