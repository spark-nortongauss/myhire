import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { completeInterviewSession } from "@/lib/interview-prep/data";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { sessionId?: string } | null;
  if (!body?.sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 });

  const completed = await completeInterviewSession(supabase, user.id, body.sessionId);
  if (!completed) return NextResponse.json({ error: "Could not complete live session" }, { status: 500 });

  return NextResponse.json({ ok: true, session: completed });
}
