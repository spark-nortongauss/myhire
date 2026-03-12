import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateJobApplication } from "@/lib/jobs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { id?: string; payload?: Record<string, unknown> } | null;
  if (!body?.id || !body.payload) return NextResponse.json({ error: "id and payload are required" }, { status: 400 });

  const blockedKeys = new Set(["id", "user_id", "created_at", "updated_at"]);
  const payload = Object.fromEntries(Object.entries(body.payload).filter(([key]) => !blockedKeys.has(key)));

  const result = await updateJobApplication(supabase, user.id, body.id, payload);
  if (!result.ok) return NextResponse.json({ error: result.error ?? "Unable to update job" }, { status: 400 });

  return NextResponse.json({ ok: true });
}
