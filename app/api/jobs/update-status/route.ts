import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateJobApplication } from "@/lib/jobs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { id?: string; status?: string } | null;
  if (!body?.id || !body?.status) return NextResponse.json({ error: "id and status are required" }, { status: 400 });

  const result = await updateJobApplication(supabase, user.id, body.id, {
    status: body.status,
    status_updated_at: new Date().toISOString()
  });

  if (!result.ok) return NextResponse.json({ error: result.error ?? "Could not update status" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
