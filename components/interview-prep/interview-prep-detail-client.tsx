"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { InterviewPrepRow, MockInterviewMessageRow, MockInterviewSessionRow } from "@/types/interview-prep";

type Props = {
  prep: InterviewPrepRow;
  job: any;
  sessions: MockInterviewSessionRow[];
  initialMessages: MockInterviewMessageRow[];
};

export function InterviewPrepDetailClient({ prep, job, sessions, initialMessages }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(sessions.find((s) => s.session_status === "active")?.id ?? null);
  const [messages, setMessages] = useState<MockInterviewMessageRow[]>(initialMessages);
  const [answer, setAnswer] = useState("");

  const activeQuestion = [...messages].reverse().find((m) => m.role === "assistant" && m.question_text)?.question_text ?? null;

  const generatePrep = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/interview-prep/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interviewPrepId: prep.id })
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error || "Could not generate interview prep.");
      setLoading(false);
      return;
    }

    setLoading(false);
    router.refresh();
  };

  const startSession = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/interview-prep/start-written", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interviewPrepId: prep.id })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error || "Unable to start session");
      setLoading(false);
      return;
    }

    setSessionId(payload.sessionId);
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        session_id: payload.sessionId,
        role: "assistant",
        question_text: payload.firstQuestion,
        answer_text: null,
        feedback_text: null,
        score: 0,
        created_at: new Date().toISOString()
      }
    ]);
    setLoading(false);
    router.refresh();
  };

  const submitAnswer = async () => {
    if (!sessionId || !answer.trim()) return;
    setLoading(true);
    setError(null);

    const submittedAnswer = answer.trim();
    setMessages((prev) => [
      ...prev,
      {
        id: `local-a-${Date.now()}`,
        session_id: sessionId,
        role: "user",
        question_text: null,
        answer_text: submittedAnswer,
        feedback_text: null,
        score: 0,
        created_at: new Date().toISOString()
      }
    ]);
    setAnswer("");

    const res = await fetch("/api/interview-prep/submit-written-answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, answerText: submittedAnswer })
    });
    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(payload.error || "Failed to submit answer");
      setLoading(false);
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `local-q-${Date.now()}`,
        session_id: sessionId,
        role: "assistant",
        question_text: payload.evaluation?.next_question ?? "",
        answer_text: null,
        feedback_text: payload.evaluation?.feedback_text ?? null,
        score: payload.evaluation?.score ?? 0,
        created_at: new Date().toISOString()
      }
    ]);

    setLoading(false);
    router.refresh();
  };

  const endSession = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/interview-prep/end-written", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error || "Unable to end session");
      setLoading(false);
      return;
    }
    setSessionId(null);
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="card space-y-2">
        <h1 className="text-2xl font-bold">{job?.job_title || "Untitled job"}</h1>
        <p className="text-muted-foreground">{job?.company_name || "Unknown company"}</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <p className="text-sm">Stage: <strong>{prep.interview_stage || "general"}</strong></p>
          <p className="text-sm">Type: <strong>{prep.interview_type || "general"}</strong></p>
          <p className="text-sm">Prep status: <strong>{prep.prep_status || "in_preparation"}</strong></p>
          <p className="text-sm">Readiness: <strong>{Math.round(Number(prep.overall_readiness_score ?? 0))}</strong></p>
        </div>
      </div>

      <div className="card space-y-2">
        <h2 className="text-lg font-semibold">Job context</h2>
        <p><strong>Brief description:</strong> {job?.brief_description || "-"}</p>
        <p className="whitespace-pre-wrap"><strong>Full job description:</strong> {job?.job_description || "-"}</p>
        <p><strong>Location:</strong> {job?.location || "-"}</p>
        <p><strong>Salary:</strong> {job?.salary_text || "-"}</p>
        <p className="whitespace-pre-wrap"><strong>Notes:</strong> {job?.notes || "-"}</p>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">AI Prep</h2>
          <Button disabled={loading} onClick={generatePrep}>Generate interview prep</Button>
        </div>
        <List title="Likely interview questions" values={prep.recommended_questions} />
        <List title="Extracted skills" values={prep.key_skills_extracted} />
        <List title="Preparation tips" values={prep.prep_tips} />
        <List title="Questions to ask interviewer" values={prep.suggested_questions_to_ask} />
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">Mock Interview</h2>
        <p className="text-sm text-muted-foreground">Mode: written only</p>
        <div className="flex flex-wrap gap-2">
          {!sessionId ? <Button disabled={loading} onClick={startSession}>Start Written Interview</Button> : null}
          {sessionId ? <Button variant="ghost" disabled={loading} onClick={endSession}>End session</Button> : null}
        </div>
        {activeQuestion ? <p className="rounded-md border bg-slate-50 p-3 text-sm"><strong>Current question:</strong> {activeQuestion}</p> : <p className="text-sm text-muted-foreground">No active question yet.</p>}
        {sessionId ? <div className="space-y-2"><Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type your answer" className="min-h-28" /><Button disabled={loading || !answer.trim()} onClick={submitAnswer}>Submit answer</Button></div> : null}
      </div>

      <div className="card space-y-2">
        <h2 className="text-lg font-semibold">Session history</h2>
        {sessions.length ? sessions.map((session) => <div key={session.id} className="rounded-md border p-2 text-sm">Session {new Date(session.created_at || "").toLocaleString() || "-"} · Status: {session.session_status || "-"} · Score: {Math.round(Number(session.overall_score ?? 0))}</div>) : <p className="text-sm text-muted-foreground">No sessions yet.</p>}
      </div>

      <div className="card space-y-2">
        <h2 className="text-lg font-semibold">Conversation</h2>
        {messages.length ? messages.map((message) => (
          <div key={message.id} className="rounded-md border p-2 text-sm">
            <p className="font-medium">{message.role}</p>
            {message.question_text ? <p><strong>Question:</strong> {message.question_text}</p> : null}
            {message.answer_text ? <p><strong>Answer:</strong> {message.answer_text}</p> : null}
            {message.feedback_text ? <p><strong>Feedback:</strong> {message.feedback_text}</p> : null}
            {typeof message.score === "number" && message.score > 0 ? <p><strong>Score:</strong> {Math.round(Number(message.score))}</p> : null}
          </div>
        )) : <p className="text-sm text-muted-foreground">No conversation yet.</p>}
      </div>
    </div>
  );
}

function List({ title, values }: { title: string; values: string[] | null | undefined }) {
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      {values?.length ? <ul className="ml-5 list-disc text-sm">{values.map((item, idx) => <li key={`${title}-${idx}`}>{item}</li>)}</ul> : <p className="text-sm text-muted-foreground">No data yet.</p>}
    </div>
  );
}
