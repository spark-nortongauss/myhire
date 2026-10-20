import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { cvInputSchema, isOwnCvPath, toCvVersion, type CvRow } from "@/lib/cvs";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("user_cvs").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load CV profiles." }, { status: 500 });
  return NextResponse.json({ cvs: (data as CvRow[]).map(toCvVersion) });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = cvInputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Invalid CV profile." }, { status: 400 });
  const cv = input.data;
  if (!isOwnCvPath(cv.filePath, user.id)) return NextResponse.json({ error: "Invalid CV file owner." }, { status: 403 });
  // A retry of a browser migration must never overwrite an existing account profile.
  const id = cv.id ?? crypto.randomUUID();
  const { data: existing } = await supabase.from("user_cvs").select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!existing) {
    const { error } = await supabase.from("user_cvs").insert({ id, user_id: user.id, name: cv.name,
      parsed_text: cv.summary, parsed_skills: cv.skills.split(/[,\n]/).map((item) => item.trim()).filter(Boolean),
      file_path: cv.filePath || null, file_name: cv.fileName || cv.filePath?.split("/").at(-1) || null,
      file_size_bytes: cv.fileSize ?? null, mime_type: cv.filePath ? "application/pdf" : null, is_default: false });
    if (error) return NextResponse.json({ error: "Could not save CV profile." }, { status: 500 });
  }
  if (cv.isDefault) {
    const { error } = await supabase.rpc("set_default_cv", { p_cv_id: id });
    if (error) return NextResponse.json({ ok: true, id, warning: "CV saved. Please select Set default again." });
  }
  return NextResponse.json({ ok: true, id });
}

const updateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set-default"), id: z.string().uuid() }),
  z.object({ action: z.literal("attach-file"), id: z.string().uuid(), filePath: z.string().min(1).max(1000),
    fileName: z.string().max(255), fileSize: z.number().int().min(0).max(5 * 1024 * 1024) })
]);

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const body = parsed.data;
  if (body.action === "set-default") {
    const { error } = await supabase.rpc("set_default_cv", { p_cv_id: body.id });
    if (error) return NextResponse.json({ error: "Could not set default CV." }, { status: 400 });
  } else {
    if (!isOwnCvPath(body.filePath, user.id)) return NextResponse.json({ error: "Invalid CV file owner." }, { status: 403 });
    const { data, error } = await supabase.from("user_cvs").update({ file_path: body.filePath, file_name: body.fileName,
      file_size_bytes: body.fileSize, mime_type: "application/pdf" }).eq("id", body.id).eq("user_id", user.id).select("id").maybeSingle();
    if (error || !data) return NextResponse.json({ error: "Could not attach CV file." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid CV ID." }, { status: 400 });
  const { error } = await supabase.from("user_cvs").delete().eq("id", parsed.data.id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Could not delete CV profile." }, { status: 500 });
  // Keep files already attached to applications; deleting a profile must not destroy their evidence.
  return NextResponse.json({ ok: true });
}
