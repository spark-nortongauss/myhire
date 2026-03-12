import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInterviewPrepById, getSessionMessages } from "@/lib/interview-prep/data";
import { InterviewPrepDetailClient } from "@/components/interview-prep/interview-prep-detail-client";

export default async function InterviewPrepDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return notFound();

  const detail = await getInterviewPrepById(supabase, user.id, params.id);
  if (!detail) return notFound();

  const activeSession = detail.sessions.find((session) => session.session_status === "active") ?? detail.sessions[0] ?? null;
  const messages = activeSession ? await getSessionMessages(supabase, activeSession.id) : [];

  return <InterviewPrepDetailClient prep={detail.prep} job={detail.job} sessions={detail.sessions} initialMessages={messages} />;
}
