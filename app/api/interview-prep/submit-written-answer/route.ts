import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addInterviewMessage, getSessionMessages } from "@/lib/interview-prep/data";
import { evaluateWrittenAnswer } from "@/lib/interview-prep/ai";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { sessionId?: string; answerText?: string } | null;
  if (!body?.sessionId || !body?.answerText?.trim()) {
    return NextResponse.json({ error: "sessionId and answerText are required" }, { status: 400 });
  }

  const { data: session } = await supabase
    .from("mock_interview_sessions")
    .select("*")
    .eq("id", body.sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.session_status !== "active") return NextResponse.json({ error: "Session is not active" }, { status: 400 });

  const { data: prep } = await supabase
    .from("interview_prep")
    .select("*")
    .eq("id", session.interview_prep_id)
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: job } = await supabase
    .from("job_applications")
    .select("job_title,company_name")
    .eq("id", session.job_application_id)
    .eq("user_id", user.id)
    .maybeSingle();

  const messages = await getSessionMessages(supabase, session.id);
  const currentQuestion = [...messages].reverse().find((m) => m.role === "assistant" && m.question_text)?.question_text ?? "Please tell me about yourself.";

  await addInterviewMessage(supabase, session.id, { role: "user", answer_text: body.answerText.trim(), score: 0 });

  const evaluation = await evaluateWrittenAnswer({
    question: currentQuestion,
    answer: body.answerText.trim(),
    job_title: job?.job_title,
    company_name: job?.company_name,
    interview_stage: prep?.interview_stage,
    interview_type: prep?.interview_type
  });

  if (!evaluation) {
    return NextResponse.json({ error: "AI evaluation unavailable. Please retry." }, { status: 503 });
  }

  await addInterviewMessage(supabase, session.id, {
    role: "assistant",
    question_text: evaluation.next_question,
    feedback_text: evaluation.feedback_text,
    score: evaluation.score
  });

  const scoreValues = [...messages.map((m) => Number(m.score ?? 0)).filter((s) => s > 0), evaluation.score];
  const overall = scoreValues.length ? Math.round(scoreValues.reduce((acc, n) => acc + n, 0) / scoreValues.length) : evaluation.score;

  await supabase.from("mock_interview_sessions").update({ overall_score: overall }).eq("id", session.id).eq("user_id", user.id);
  await supabase.from("interview_prep").update({ overall_readiness_score: overall, last_session_at: new Date().toISOString() }).eq("id", prep?.id ?? "").eq("user_id", user.id);

  return NextResponse.json({ ok: true, evaluation });
}
