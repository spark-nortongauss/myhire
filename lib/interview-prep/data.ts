import type { SupabaseClient } from "@supabase/supabase-js";
import type { InterviewPrepListItem, InterviewPrepRow, InterviewerSelectionPayload, MockInterviewMessageRow, MockInterviewSessionRow } from "@/types/interview-prep";
import { normalizeInterviewerSelection } from "@/lib/interview-prep/constants";

type DBClient = SupabaseClient<any, "public", any>;

export async function getInterviewPrepList(supabase: DBClient, userId: string): Promise<InterviewPrepListItem[]> {
  const { data: prepRows, error } = await supabase
    .from("interview_prep")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error || !prepRows?.length) return [];

  const jobIds = prepRows.map((row: InterviewPrepRow) => row.job_application_id).filter(Boolean);
  const { data: jobs } = await supabase
    .from("job_applications")
    .select("id,job_title,company_name")
    .eq("user_id", userId)
    .in("id", jobIds);

  const jobsById = new Map((jobs ?? []).map((job: any) => [job.id, job]));
  return prepRows.map((row: InterviewPrepRow) => ({
    ...row,
    job_title: jobsById.get(row.job_application_id)?.job_title ?? null,
    company_name: jobsById.get(row.job_application_id)?.company_name ?? null
  }));
}

export async function getInterviewPrepById(supabase: DBClient, userId: string, prepId: string) {
  const { data: prep, error } = await supabase
    .from("interview_prep")
    .select("*")
    .eq("id", prepId)
    .eq("user_id", userId)
    .maybeSingle<InterviewPrepRow>();

  if (error || !prep) return null;

  const { data: job } = await supabase
    .from("job_applications")
    .select("id,job_title,company_name,brief_description,job_description,location,salary_text,notes,industry")
    .eq("id", prep.job_application_id)
    .eq("user_id", userId)
    .maybeSingle();

  const { data: sessions } = await supabase
    .from("mock_interview_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("interview_prep_id", prepId)
    .order("created_at", { ascending: false })
    .limit(50);

  return {
    prep,
    job: job ?? null,
    sessions: (sessions ?? []) as MockInterviewSessionRow[]
  };
}

export async function ensureInterviewPrepForJob(supabase: DBClient, jobApplicationId: string, userId: string) {
  const { data: existing } = await supabase
    .from("interview_prep")
    .select("id")
    .eq("job_application_id", jobApplicationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.id) return existing;

  const { data: created, error } = await supabase
    .from("interview_prep")
    .insert({
      user_id: userId,
      job_application_id: jobApplicationId,
      interview_stage: "general",
      interview_type: "general",
      prep_status: "in_preparation",
      overall_readiness_score: 0
    })
    .select("id")
    .maybeSingle();

  if (error) {
    const { data: retryExisting } = await supabase
      .from("interview_prep")
      .select("id")
      .eq("job_application_id", jobApplicationId)
      .eq("user_id", userId)
      .maybeSingle();
    return retryExisting;
  }

  return created;
}

export async function createWrittenInterviewSession(supabase: DBClient, userId: string, interviewPrepId: string, jobApplicationId: string) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("mock_interview_sessions")
    .insert({
      user_id: userId,
      interview_prep_id: interviewPrepId,
      job_application_id: jobApplicationId,
      mode: "written",
      session_status: "active",
      started_at: now
    })
    .select("*")
    .maybeSingle<MockInterviewSessionRow>();

  if (error) return null;
  return data;
}

export async function addInterviewMessage(
  supabase: DBClient,
  sessionId: string,
  payload: Partial<Pick<MockInterviewMessageRow, "role" | "question_text" | "answer_text" | "feedback_text" | "score">>
) {
  const { data, error } = await supabase
    .from("mock_interview_messages")
    .insert({
      session_id: sessionId,
      role: payload.role ?? "assistant",
      question_text: payload.question_text ?? null,
      answer_text: payload.answer_text ?? null,
      feedback_text: payload.feedback_text ?? null,
      score: payload.score ?? 0
    })
    .select("*")
    .maybeSingle<MockInterviewMessageRow>();

  if (error) return null;
  return data;
}

export async function completeInterviewSession(supabase: DBClient, userId: string, sessionId: string) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("mock_interview_sessions")
    .update({ session_status: "completed", ended_at: now })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle<MockInterviewSessionRow>();

  if (error) return null;
  return data;
}

export async function getSessionMessages(supabase: DBClient, sessionId: string) {
  const { data } = await supabase
    .from("mock_interview_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  return (data ?? []) as MockInterviewMessageRow[];
}


export async function updateInterviewerSelection(
  supabase: DBClient,
  userId: string,
  prepId: string,
  payload: InterviewerSelectionPayload
) {
  const selected = normalizeInterviewerSelection(payload.selected_interviewers);
  const { data, error } = await supabase
    .from("interview_prep")
    .update({
      selected_interviewers: selected,
      other_interviewer_detail: payload.other_interviewer_detail?.trim() || null,
      team_description: payload.team_description?.trim() || null,
      team_members_summary: payload.team_members_summary?.trim() || null,
      team_skills: payload.team_skills?.trim() || null,
      team_dynamics: payload.team_dynamics?.trim() || null
    })
    .eq("id", prepId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle<InterviewPrepRow>();

  if (error) return null;
  return data;
}
