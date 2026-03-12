import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteInterviewPrepByIds } from "@/lib/interview-prep/data";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0) : [];
  if (!ids.length) return NextResponse.json({ error: "At least one id is required" }, { status: 400 });

  const result = await deleteInterviewPrepByIds(supabase, user.id, ids);
  if (!result.deletedIds.length && result.failedIds.length) {
    return NextResponse.json({ error: "Unable to delete selected rows", failedIds: result.failedIds }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...result });
}
