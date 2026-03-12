import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateInterviewerSelection } from "@/lib/interview-prep/data";
import { validateInterviewerSelection } from "@/lib/interview-prep/constants";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    interviewPrepId?: string;
    selected_interviewers?: unknown;
    other_interviewer_detail?: string;
    team_description?: string;
    team_members_summary?: string;
    team_skills?: string;
    team_dynamics?: string;
  } | null;

  if (!body?.interviewPrepId) {
    return NextResponse.json({ error: "interviewPrepId is required" }, { status: 400 });
  }

  const selectionCheck = validateInterviewerSelection(body.selected_interviewers);
  if (!selectionCheck.valid) {
    return NextResponse.json({ error: selectionCheck.message ?? "Invalid interviewer selection" }, { status: 400 });
  }

  const updated = await updateInterviewerSelection(supabase, user.id, body.interviewPrepId, {
    selected_interviewers: selectionCheck.selected,
    other_interviewer_detail: body.other_interviewer_detail,
    team_description: body.team_description,
    team_members_summary: body.team_members_summary,
    team_skills: body.team_skills,
    team_dynamics: body.team_dynamics
  });

  if (!updated) {
    return NextResponse.json({ error: "Unable to update interviewer selection" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, prep: updated });
}
