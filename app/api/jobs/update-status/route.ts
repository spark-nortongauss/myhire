import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureInterviewPrepForJob } from "@/lib/interview-prep/data";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { id?: string; status?: string } | null;
  if (!body?.id || !body?.status) return NextResponse.json({ error: "id and status are required" }, { status: 400 });

  const { error } = await supabase
    .from("job_applications")
    .update({ status: body.status, status_updated_at: new Date().toISOString() })
    .eq("id", body.id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.status === "interview") {
    await ensureInterviewPrepForJob(supabase, body.id, user.id);
  }

  return NextResponse.json({ ok: true });
}
