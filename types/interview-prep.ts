export interface InterviewPrepRow {
  id: string;
  user_id: string;
  job_application_id: string;
  interview_stage: string | null;
  interview_type: string | null;
  prep_status: string | null;
  overall_readiness_score: number | null;
  company_research: string | null;
  key_skills_extracted: string[] | null;
  recommended_questions: string[] | null;
  prep_tips: string[] | null;
  suggested_questions_to_ask: string[] | null;
  selected_interviewers: string[] | null;
  other_interviewer_detail: string | null;
  team_description: string | null;
  team_members_summary: string | null;
  team_skills: string | null;
  team_dynamics: string | null;
  last_session_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface MockInterviewSessionRow {
  id: string;
  user_id: string;
  interview_prep_id: string;
  job_application_id: string;
  mode: string | null;
  session_status: string | null;
  started_at: string | null;
  ended_at: string | null;
  overall_score: number | null;
  summary_feedback: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface MockInterviewMessageRow {
  id: string;
  session_id: string;
  role: string;
  question_text: string | null;
  answer_text: string | null;
  feedback_text: string | null;
  score: number | null;
  created_at: string | null;
}

export interface InterviewPrepListItem extends InterviewPrepRow {
  job_title: string | null;
  company_name: string | null;
}

export interface InterviewerSelectionPayload {
  selected_interviewers: string[];
  other_interviewer_detail?: string;
  team_description?: string;
  team_members_summary?: string;
  team_skills?: string;
  team_dynamics?: string;
}

export interface GeneratedInterviewPrepPayload {
  key_skills_extracted: string[];
  recommended_questions: string[];
  prep_tips: string[];
  suggested_questions_to_ask: string[];
}

export interface WrittenAnswerEvaluationPayload {
  score: number;
  feedback_text: string;
  next_question: string;
}
