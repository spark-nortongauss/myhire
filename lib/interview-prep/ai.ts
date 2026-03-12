import OpenAI from "openai";
import type { GeneratedInterviewPrepPayload, WrittenAnswerEvaluationPayload } from "@/types/interview-prep";

type ConversationTurn = {
  question_text?: string | null;
  answer_text?: string | null;
  feedback_text?: string | null;
  score?: number | null;
};

function parseJson(content: string | null | undefined) {
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}


function buildInterviewerGuidance(selectedInterviewers: string[] | null | undefined) {
  const selected = Array.isArray(selectedInterviewers) ? selectedInterviewers : [];
  const guidance: string[] = [];
  if (selected.includes("HR Manager")) guidance.push("HR Manager: behavioral, motivation, fit, conflict, communication.");
  if (selected.some((v) => ["CTO", "Technical Manager", "VP Engineering"].includes(v))) guidance.push("Technical leadership profiles: architecture, systems, tradeoffs, depth.");
  if (selected.some((v) => ["CEO", "Founder", "COO"].includes(v))) guidance.push("Executive profiles: leadership, business judgment, ownership, impact.");
  if (selected.includes("Sales Director")) guidance.push("Sales Director: customer value, communication, persuasion, revenue orientation.");
  if (selected.includes("Meet the Team")) guidance.push("Meet the Team: collaboration, practical execution, peer interaction, daily work style.");
  if (!guidance.length) guidance.push("Use a balanced professional interview style tailored to role and stage.");
  return guidance;
}

export async function generateInterviewPrepContent(input: {
  job_title?: string | null;
  company_name?: string | null;
  brief_description?: string | null;
  job_description?: string | null;
  location?: string | null;
  industry?: string | null;
  notes?: string | null;
  interview_stage?: string | null;
  interview_type?: string | null;
  selected_interviewers?: string[] | null;
  other_interviewer_detail?: string | null;
  team_description?: string | null;
  team_members_summary?: string | null;
  team_skills?: string | null;
  team_dynamics?: string | null;
}): Promise<GeneratedInterviewPrepPayload | null> {
  const openai = getOpenAI();
  if (!openai) return null;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "Return valid JSON only with keys key_skills_extracted, recommended_questions, prep_tips, suggested_questions_to_ask. All values must be arrays of concise strings."
      },
      {
        role: "user",
        content: `Prepare interview guidance with this context:\n${JSON.stringify({ ...input, interviewer_guidance: buildInterviewerGuidance(input.selected_interviewers) }).slice(0, 12000)}`
      }
    ]
  });

  const parsed = parseJson(completion.choices[0]?.message?.content) as Partial<GeneratedInterviewPrepPayload> | null;
  if (!parsed) return null;

  return {
    key_skills_extracted: Array.isArray(parsed.key_skills_extracted) ? parsed.key_skills_extracted.filter(Boolean).map(String) : [],
    recommended_questions: Array.isArray(parsed.recommended_questions) ? parsed.recommended_questions.filter(Boolean).map(String) : [],
    prep_tips: Array.isArray(parsed.prep_tips) ? parsed.prep_tips.filter(Boolean).map(String) : [],
    suggested_questions_to_ask: Array.isArray(parsed.suggested_questions_to_ask) ? parsed.suggested_questions_to_ask.filter(Boolean).map(String) : []
  };
}

export async function generateFirstWrittenQuestion(input: {
  job_title?: string | null;
  company_name?: string | null;
  brief_description?: string | null;
  job_description?: string | null;
  location?: string | null;
  industry?: string | null;
  notes?: string | null;
  interview_stage?: string | null;
  interview_type?: string | null;
  selected_interviewers?: string[] | null;
  other_interviewer_detail?: string | null;
  team_description?: string | null;
  team_members_summary?: string | null;
  team_skills?: string | null;
  team_dynamics?: string | null;
}) {
  const openai = getOpenAI();
  if (!openai) return null;
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    messages: [
      { role: "system", content: "Generate one professional interview question for a written mock interview. Return plain text only." },
      { role: "user", content: `Context: ${JSON.stringify({ ...input, interviewer_guidance: buildInterviewerGuidance(input.selected_interviewers) }).slice(0, 12000)}` }
    ]
  });

  return completion.choices[0]?.message?.content?.trim() ?? null;
}

export async function evaluateWrittenAnswer(input: {
  question: string;
  answer: string;
  job_title?: string | null;
  company_name?: string | null;
  interview_stage?: string | null;
  interview_type?: string | null;
  selected_interviewers?: string[] | null;
  other_interviewer_detail?: string | null;
  team_description?: string | null;
  team_members_summary?: string | null;
  team_skills?: string | null;
  team_dynamics?: string | null;
}): Promise<WrittenAnswerEvaluationPayload | null> {
  const openai = getOpenAI();
  if (!openai) return null;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: "Return JSON only with keys: score (0-100), feedback_text (concise practical feedback), next_question (one follow-up question)."
      },
      {
        role: "user",
        content: `Evaluate this interview answer and generate next question. Input: ${JSON.stringify({ ...input, interviewer_guidance: buildInterviewerGuidance(input.selected_interviewers) }).slice(0, 12000)}`
      }
    ]
  });

  const parsed = parseJson(completion.choices[0]?.message?.content) as Partial<WrittenAnswerEvaluationPayload> | null;
  if (!parsed) return null;

  const rawScore = Number(parsed.score ?? 0);
  return {
    score: Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : 0,
    feedback_text: String(parsed.feedback_text ?? "No feedback available."),
    next_question: String(parsed.next_question ?? "Can you share a specific example from your past work?")
  };
}

export async function generateFirstLiveQuestion(input: {
  job_title?: string | null;
  company_name?: string | null;
  brief_description?: string | null;
  job_description?: string | null;
  location?: string | null;
  industry?: string | null;
  notes?: string | null;
  interview_stage?: string | null;
  interview_type?: string | null;
  selected_interviewers?: string[] | null;
  other_interviewer_detail?: string | null;
  team_description?: string | null;
  team_members_summary?: string | null;
  team_skills?: string | null;
  team_dynamics?: string | null;
}): Promise<{ first_question: string } | null> {
  const openai = getOpenAI();
  if (!openai) return null;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: "Return JSON only with key first_question containing one concise professional opening interview question for a live voice interview."
      },
      {
        role: "user",
        content: `Context: ${JSON.stringify({ ...input, interviewer_guidance: buildInterviewerGuidance(input.selected_interviewers) }).slice(0, 12000)}`
      }
    ]
  });

  const parsed = parseJson(completion.choices[0]?.message?.content) as { first_question?: string } | null;
  if (!parsed?.first_question) return null;
  return { first_question: String(parsed.first_question).trim() || "Can you briefly introduce yourself and your fit for this role?" };
}

export async function evaluateLiveAnswer(input: {
  question: string;
  answer: string;
  prior_turns?: ConversationTurn[];
  job_title?: string | null;
  company_name?: string | null;
  interview_stage?: string | null;
  interview_type?: string | null;
  selected_interviewers?: string[] | null;
  other_interviewer_detail?: string | null;
  team_description?: string | null;
  team_members_summary?: string | null;
  team_skills?: string | null;
  team_dynamics?: string | null;
}): Promise<WrittenAnswerEvaluationPayload | null> {
  const openai = getOpenAI();
  if (!openai) return null;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: "You are running a live interview. Return JSON only with keys: score (0-100), feedback_text (short and practical), next_question (one dynamic follow-up based on answer and prior turns)."
      },
      {
        role: "user",
        content: `Evaluate this live interview answer and produce the next question. Input: ${JSON.stringify({ ...input, interviewer_guidance: buildInterviewerGuidance(input.selected_interviewers) }).slice(0, 12000)}`
      }
    ]
  });

  const parsed = parseJson(completion.choices[0]?.message?.content) as Partial<WrittenAnswerEvaluationPayload> | null;
  if (!parsed) return null;

  const rawScore = Number(parsed.score ?? 0);
  return {
    score: Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : 0,
    feedback_text: String(parsed.feedback_text ?? "No feedback available."),
    next_question: String(parsed.next_question ?? "Can you provide a concrete example that demonstrates your impact?")
  };
}
