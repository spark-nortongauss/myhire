"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { INTERVIEWER_OPTIONS, MAX_INTERVIEWERS, MIN_INTERVIEWERS, includesMeetTheTeam, validateInterviewerSelection } from "@/lib/interview-prep/constants";
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
  const activeWritten = sessions.find((s) => s.session_status === "active" && s.mode === "written")?.id ?? null;
  const activeLive = sessions.find((s) => s.session_status === "active" && s.mode === "live")?.id ?? null;
  const [sessionId, setSessionId] = useState<string | null>(activeWritten);
  const [liveSessionId, setLiveSessionId] = useState<string | null>(activeLive);
  const [mode, setMode] = useState<"written" | "live">("written");
  const [messages, setMessages] = useState<MockInterviewMessageRow[]>(initialMessages);
  const [answer, setAnswer] = useState("");
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [micStatus, setMicStatus] = useState<"unsupported" | "idle" | "listening" | "processing" | "error">("idle");
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const [selectedInterviewers, setSelectedInterviewers] = useState<string[]>(Array.isArray(prep.selected_interviewers) ? prep.selected_interviewers : []);
  const [otherDetail, setOtherDetail] = useState(prep.other_interviewer_detail ?? "");
  const [teamDescription, setTeamDescription] = useState(prep.team_description ?? "");
  const [teamMembersSummary, setTeamMembersSummary] = useState(prep.team_members_summary ?? "");
  const [teamSkills, setTeamSkills] = useState(prep.team_skills ?? "");
  const [teamDynamics, setTeamDynamics] = useState(prep.team_dynamics ?? "");

  const supportsSpeechRecognition = typeof window !== "undefined" && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const supportsSpeechSynthesis = typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";

  useEffect(() => {
    if (!supportsSpeechRecognition) {
      setMicStatus("unsupported");
      setSpeechError("Live voice interview is not supported in this browser. Please use Chrome or Edge, or use Written Interview.");
      return;
    }

    if (micStatus === "unsupported") setMicStatus("idle");
  }, [micStatus, supportsSpeechRecognition]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop?.();
      recognitionRef.current = null;
    };
  }, []);

  const activeQuestion = [...messages].reverse().find((m) => m.role === "assistant" && m.question_text)?.question_text ?? null;
  const selectionValidation = useMemo(() => validateInterviewerSelection(selectedInterviewers), [selectedInterviewers]);
  const meetTeamEnabled = includesMeetTheTeam(selectedInterviewers);
  const otherEnabled = selectedInterviewers.includes("Other");

  const speakText = (text: string | null | undefined) => {
    if (!supportsSpeechSynthesis || !text?.trim()) return;
    const utterance = new SpeechSynthesisUtterance(text.trim());
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const startVoiceCapture = () => {
    if (!supportsSpeechRecognition || isListeningRef.current) return;

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setMicStatus("unsupported");
      setSpeechError("Live voice interview is not supported in this browser. Please use Chrome or Edge, or use Written Interview.");
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SR();
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.onstart = () => {
        setIsListening(true);
        setMicStatus("listening");
      };
      recognition.onresult = (event: any) => {
        const nextTranscript = Array.from(event.results ?? []).map((r: any) => r?.[0]?.transcript ?? "").join(" ").trim();
        setTranscript(nextTranscript);
      };
      recognition.onerror = (event: any) => {
        const code = event?.error || "unknown";
        const message = code === "not-allowed"
          ? "Microphone permission was denied. Please allow microphone access and try again."
          : code === "audio-capture"
            ? "No microphone was detected. Check your input device and browser permissions."
            : code === "no-speech"
              ? "No speech was detected. Please try speaking again."
              : code === "network"
                ? "Speech recognition network error. Check your connection and retry."
                : code === "aborted"
                  ? "Recording was stopped before speech could be captured."
                  : `Speech recognition error: ${code}.`;
        if (process.env.NODE_ENV !== "production") {
          console.error("[LiveInterview] Speech recognition error", { code, event });
        }
        setIsListening(false);
        setMicStatus("error");
        setSpeechError(message);
      };
      recognition.onend = () => {
        setIsListening(false);
        setMicStatus((prev) => (prev === "error" || prev === "unsupported" ? prev : "idle"));
      };
      recognitionRef.current = recognition;
    }

    setSpeechError(null);
    setMicStatus("processing");
    try {
      recognitionRef.current.start();
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[LiveInterview] Failed to start speech recognition", err);
      }
      setIsListening(false);
      setMicStatus("error");
      setSpeechError("Unable to start microphone capture. Please retry or type your answer manually.");
    }
  };

  const stopVoiceCapture = () => {
    recognitionRef.current?.stop?.();
    setIsListening(false);
    setMicStatus("processing");
  };

  const retryVoiceCapture = () => {
    setTranscript("");
    setSpeechError(null);
    if (supportsSpeechRecognition) {
      setMicStatus("idle");
    }
  };

  const toggleInterviewer = (option: string) => {
    setError(null);
    setSelectedInterviewers((prev) => {
      if (prev.includes(option)) return prev.filter((item) => item !== option);
      if (prev.length >= MAX_INTERVIEWERS) return prev;
      return [...prev, option];
    });
  };

  const saveInterviewerSelection = async () => {
    setLoading(true);
    setError(null);

    if (!selectionValidation.valid) {
      setError(selectionValidation.message ?? "Select interviewers before saving.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/interview-prep/update-interviewers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        interviewPrepId: prep.id,
        selected_interviewers: selectionValidation.selected,
        other_interviewer_detail: otherDetail,
        team_description: teamDescription,
        team_members_summary: teamMembersSummary,
        team_skills: teamSkills,
        team_dynamics: teamDynamics
      })
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error || "Unable to save interviewer selection.");
      setLoading(false);
      return;
    }

    setLoading(false);
    router.refresh();
  };

  const ensureInterviewersSelected = () => {
    if (!selectionValidation.valid) {
      setError(selectionValidation.message ?? "Select at least one interviewer profile.");
      return false;
    }
    return true;
  };

  const generatePrep = async () => {
    if (!ensureInterviewersSelected()) return;
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
    if (!ensureInterviewersSelected()) return;
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
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, session_id: payload.sessionId, role: "assistant", question_text: payload.firstQuestion, answer_text: null, feedback_text: null, score: 0, created_at: new Date().toISOString() }]);
    setLoading(false);
    router.refresh();
  };

  const submitAnswer = async () => {
    if (!sessionId || !answer.trim()) return;
    setLoading(true);
    setError(null);

    const submittedAnswer = answer.trim();
    setMessages((prev) => [...prev, { id: `local-a-${Date.now()}`, session_id: sessionId, role: "user", question_text: null, answer_text: submittedAnswer, feedback_text: null, score: 0, created_at: new Date().toISOString() }]);
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

    setMessages((prev) => [...prev, { id: `local-q-${Date.now()}`, session_id: sessionId, role: "assistant", question_text: payload.evaluation?.next_question ?? "", answer_text: null, feedback_text: payload.evaluation?.feedback_text ?? null, score: payload.evaluation?.score ?? 0, created_at: new Date().toISOString() }]);

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

  const startLiveSession = async () => {
    if (!ensureInterviewersSelected()) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/interview-prep/start-live", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interviewPrepId: prep.id }) });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error || "Unable to start live interview");
      setLoading(false);
      return;
    }
    setLiveSessionId(payload.sessionId);
    const firstQuestion = payload.firstQuestion || "Please introduce yourself.";
    setMessages((prev) => [...prev, { id: `live-q-${Date.now()}`, session_id: payload.sessionId, role: "assistant", question_text: firstQuestion, answer_text: null, feedback_text: null, score: 0, created_at: new Date().toISOString() }]);
    speakText(firstQuestion);
    setLoading(false);
    router.refresh();
  };

  const submitLiveTranscript = async () => {
    if (!liveSessionId || !transcript.trim()) {
      setError("Transcript is empty. Please record your answer first.");
      return;
    }
    setLoading(true);
    setError(null);
    const submittedTranscript = transcript.trim();
    setMessages((prev) => [...prev, { id: `live-a-${Date.now()}`, session_id: liveSessionId, role: "user", question_text: null, answer_text: submittedTranscript, feedback_text: null, score: 0, created_at: new Date().toISOString() }]);
    setTranscript("");

    const res = await fetch("/api/interview-prep/submit-live-answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: liveSessionId, transcript: submittedTranscript })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error || "Unable to submit live answer");
      setLoading(false);
      return;
    }

    const nextQ = payload.evaluation?.next_question ?? "Can you share another concrete example?";
    const feedbackText = payload.evaluation?.feedback_text ?? null;
    setLastFeedback(feedbackText);
    setMessages((prev) => [...prev, { id: `live-r-${Date.now()}`, session_id: liveSessionId, role: "assistant", question_text: nextQ, answer_text: null, feedback_text: feedbackText, score: payload.evaluation?.score ?? 0, created_at: new Date().toISOString() }]);
    speakText(nextQ);
    setLoading(false);
    router.refresh();
  };

  const endLiveSession = async () => {
    if (!liveSessionId) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/interview-prep/end-live", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: liveSessionId }) });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error || "Unable to end live session");
      setLoading(false);
      return;
    }
    stopVoiceCapture();
    setLiveSessionId(null);
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <div className="card space-y-2"><h1 className="text-2xl font-bold">{job?.job_title || "Untitled job"}</h1><p className="text-muted-foreground">{job?.company_name || "Unknown company"}</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><p className="text-sm">Stage: <strong>{prep.interview_stage || "general"}</strong></p><p className="text-sm">Type: <strong>{prep.interview_type || "general"}</strong></p><p className="text-sm">Prep status: <strong>{prep.prep_status || "in_preparation"}</strong></p><p className="text-sm">Readiness: <strong>{Math.round(Number(prep.overall_readiness_score ?? 0))}</strong></p></div></div>

      <div className="card space-y-3"><h2 className="text-lg font-semibold">Interviewers</h2><p className="text-sm text-muted-foreground">Select up to {MAX_INTERVIEWERS} interviewer profiles. At least {MIN_INTERVIEWERS} required.</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{INTERVIEWER_OPTIONS.map((option) => { const checked = selectedInterviewers.includes(option); const disabled = !checked && selectedInterviewers.length >= MAX_INTERVIEWERS; return (<label key={option} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${disabled ? "opacity-50" : ""}`}><input type="checkbox" checked={checked} disabled={disabled || loading} onChange={() => toggleInterviewer(option)} /><span>{option}</span></label>); })}</div><p className="text-sm">Current selection: {selectedInterviewers.length ? selectedInterviewers.join(", ") : "None"}</p>
        {otherEnabled ? <div className="space-y-1"><label className="text-sm font-medium">Other interviewer detail (optional)</label><Textarea className="min-h-20" value={otherDetail} onChange={(e) => setOtherDetail(e.target.value)} placeholder="Add any extra interviewer context" /></div> : null}
        {meetTeamEnabled ? <div className="space-y-2 rounded-md border bg-slate-50 p-3"><h3 className="font-medium">Meet the Team context</h3><p className="text-xs text-muted-foreground">Describe who is in the team, what each role does, likely technical/business focus, and what they may care about in the interview.</p><Textarea value={teamDescription} onChange={(e) => setTeamDescription(e.target.value)} placeholder="Team description" className="min-h-20" /><Textarea value={teamMembersSummary} onChange={(e) => setTeamMembersSummary(e.target.value)} placeholder="Team members summary" className="min-h-20" /><Textarea value={teamSkills} onChange={(e) => setTeamSkills(e.target.value)} placeholder="Team skills" className="min-h-20" /><Textarea value={teamDynamics} onChange={(e) => setTeamDynamics(e.target.value)} placeholder="Team dynamics (optional)" className="min-h-20" /></div> : null}
        <div><Button disabled={loading} onClick={saveInterviewerSelection}>Save interviewer selection</Button></div></div>

      <div className="card space-y-2"><h2 className="text-lg font-semibold">Job context</h2><p><strong>Brief description:</strong> {job?.brief_description || "-"}</p><p className="whitespace-pre-wrap"><strong>Full job description:</strong> {job?.job_description || "-"}</p><p><strong>Location:</strong> {job?.location || "-"}</p><p><strong>Salary:</strong> {job?.salary_text || "-"}</p><p className="whitespace-pre-wrap"><strong>Notes:</strong> {job?.notes || "-"}</p></div>

      <div className="card space-y-3"><div className="flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">AI Prep</h2><Button disabled={loading || !selectionValidation.valid} onClick={generatePrep}>Generate interview prep</Button></div><List title="Likely interview questions" values={prep.recommended_questions} /><List title="Extracted skills" values={prep.key_skills_extracted} /><List title="Preparation tips" values={prep.prep_tips} /><List title="Questions to ask interviewer" values={prep.suggested_questions_to_ask} /></div>

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">Mock Interview</h2>
        <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm">
          <button className={`rounded px-3 py-1 ${mode === "written" ? "bg-white shadow" : ""}`} onClick={() => setMode("written")}>Written Interview</button>
          <button className={`rounded px-3 py-1 ${mode === "live" ? "bg-white shadow" : ""}`} onClick={() => setMode("live")}>Live Interview</button>
        </div>

        {mode === "written" ? (
          <>
            <div className="flex flex-wrap gap-2">{!sessionId ? <Button disabled={loading || !selectionValidation.valid} onClick={startSession}>Start Written Interview</Button> : null}{sessionId ? <Button variant="ghost" disabled={loading} onClick={endSession}>End session</Button> : null}</div>
            {activeQuestion ? <p className="rounded-md border bg-slate-50 p-3 text-sm"><strong>Current question:</strong> {activeQuestion}</p> : <p className="text-sm text-muted-foreground">No active question yet.</p>}
            {sessionId ? <div className="space-y-2"><Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type your answer" className="min-h-28" /><Button disabled={loading || !answer.trim()} onClick={submitAnswer}>Submit answer</Button></div> : null}
          </>
        ) : (
          <div className="space-y-3">
            {!supportsSpeechRecognition || !supportsSpeechSynthesis ? <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">Live voice mode needs browser speech APIs. You can still use written mode.</p> : null}
            {!supportsSpeechRecognition ? <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">Live voice interview is not supported in this browser. Please use Chrome or Edge, or use Written Interview.</p> : null}
            <div className="flex flex-wrap gap-2">{!liveSessionId ? <Button disabled={loading || !selectionValidation.valid} onClick={startLiveSession}>Start Live Interview</Button> : null}{liveSessionId ? <Button variant="ghost" disabled={loading} onClick={endLiveSession}>End live session</Button> : null}</div>
            <p className="rounded-md border bg-slate-50 p-3 text-sm"><strong>Current AI question:</strong> {activeQuestion || "No active question yet."}</p>
            <p className="text-sm">Microphone: <strong>{micStatus === "unsupported" ? "Unsupported" : micStatus === "listening" ? "Listening" : micStatus === "processing" ? "Processing" : micStatus === "error" ? "Error" : "Idle"}</strong></p>
            {speechError ? <p className="text-sm text-rose-700">{speechError}</p> : null}
            <Textarea className="min-h-24" value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Transcript appears here" />
            <div className="flex flex-wrap gap-2"><Button variant="ghost" disabled={!supportsSpeechRecognition || loading || isListening || !liveSessionId} onClick={startVoiceCapture}>Record answer</Button><Button variant="ghost" disabled={!isListening} onClick={stopVoiceCapture}>Stop</Button><Button variant="ghost" disabled={loading} onClick={retryVoiceCapture}>Retry</Button><Button disabled={loading || !liveSessionId || !transcript.trim()} onClick={submitLiveTranscript}>Submit transcript</Button></div>
            {lastFeedback ? <p className="rounded-md border bg-emerald-50 p-3 text-sm"><strong>Last feedback:</strong> {lastFeedback}</p> : null}
          </div>
        )}
      </div>

      <div className="card space-y-2"><h2 className="text-lg font-semibold">Session history</h2>{sessions.length ? sessions.map((session) => <div key={session.id} className="rounded-md border p-2 text-sm">Session {new Date(session.created_at || "").toLocaleString() || "-"} · Mode: {session.mode || "-"} · Status: {session.session_status || "-"} · Score: {Math.round(Number(session.overall_score ?? 0))}</div>) : <p className="text-sm text-muted-foreground">No sessions yet.</p>}</div>

      <div className="card space-y-2"><h2 className="text-lg font-semibold">Conversation</h2>{messages.length ? messages.map((message) => (<div key={message.id} className="rounded-md border p-2 text-sm"><p className="font-medium">{message.role}</p>{message.question_text ? <p><strong>Question:</strong> {message.question_text}</p> : null}{message.answer_text ? <p><strong>Answer:</strong> {message.answer_text}</p> : null}{message.feedback_text ? <p><strong>Feedback:</strong> {message.feedback_text}</p> : null}{typeof message.score === "number" && message.score > 0 ? <p><strong>Score:</strong> {Math.round(Number(message.score))}</p> : null}</div>)) : <p className="text-sm text-muted-foreground">No conversation yet.</p>}</div>
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
