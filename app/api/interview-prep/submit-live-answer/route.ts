import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addInterviewMessage, getSessionMessages } from "@/lib/interview-prep/data";
import { evaluateLiveAnswer } from "@/lib/interview-prep/ai";
import { validateInterviewerSelection } from "@/lib/interview-prep/constants";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { sessionId?: string; transcript?: string } | null;
  const transcript = body?.transcript?.trim();
  if (!body?.sessionId || !transcript) return NextResponse.json({ error: "sessionId and transcript are required" }, { status: 400 });

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

  if (!prep) return NextResponse.json({ error: "Interview prep not found" }, { status: 404 });

  const { data: job } = await supabase
    .from("job_applications")
    .select("job_title,company_name")
    .eq("id", session.job_application_id)
    .eq("user_id", user.id)
    .maybeSingle();

  const selectionCheck = validateInterviewerSelection(prep.selected_interviewers);
  if (!selectionCheck.valid) return NextResponse.json({ error: selectionCheck.message ?? "Select at least one interviewer." }, { status: 400 });

  const messages = await getSessionMessages(supabase, session.id);
  const currentQuestion = [...messages].reverse().find((m) => m.role === "assistant" && m.question_text)?.question_text ?? "Please introduce yourself.";

  await addInterviewMessage(supabase, session.id, { role: "user", answer_text: transcript, score: 0 });

  const priorTurns = [...messages]
    .filter((m) => m.role === "assistant" || m.role === "user")
    .slice(-8)
    .map((m) => ({
      question_text: m.role === "assistant" ? m.question_text : null,
      answer_text: m.role === "user" ? m.answer_text : null,
      feedback_text: m.feedback_text,
      score: m.score
    }));

  const evaluation = await evaluateLiveAnswer({
    question: currentQuestion,
    answer: transcript,
    prior_turns: priorTurns,
    job_title: job?.job_title,
    company_name: job?.company_name,
    interview_stage: prep.interview_stage,
    interview_type: prep.interview_type,
    selected_interviewers: selectionCheck.selected,
    other_interviewer_detail: prep.other_interviewer_detail,
    team_description: prep.team_description,
    team_members_summary: prep.team_members_summary,
    team_skills: prep.team_skills,
    team_dynamics: prep.team_dynamics
  });

  if (!evaluation) return NextResponse.json({ error: "AI evaluation unavailable. Please retry." }, { status: 503 });

  await addInterviewMessage(supabase, session.id, {
    role: "assistant",
    question_text: evaluation.next_question,
    feedback_text: evaluation.feedback_text,
    score: evaluation.score
  });

  const scoreValues = [...messages.map((m) => Number(m.score ?? 0)).filter((s) => s > 0), evaluation.score];
  const overall = scoreValues.length ? Math.round(scoreValues.reduce((acc, n) => acc + n, 0) / scoreValues.length) : evaluation.score;

  await supabase.from("mock_interview_sessions").update({ overall_score: overall }).eq("id", session.id).eq("user_id", user.id);
  await supabase.from("interview_prep").update({ overall_readiness_score: overall, last_session_at: new Date().toISOString() }).eq("id", prep.id).eq("user_id", user.id);

  return NextResponse.json({ ok: true, evaluation });
}
