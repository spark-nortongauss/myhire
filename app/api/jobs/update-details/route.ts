import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { updateJobApplication } from "@/lib/jobs";
const text = z.string().max(50000);
const schema = z
  .object({
    job_title: z.string().trim().min(1).max(500),
    company_name: z.string().trim().min(1).max(500),
    status: z.enum([
      "applied",
      "proposal",
      "interview",
      "offer",
      "rejected",
      "no_answer",
      "withdrawn",
    ]),
    platform: z.enum([
      "linkedin",
      "indeed",
      "apec",
      "france_travail",
      "welcome_to_the_jungle",
      "glassdoor",
      "company_website",
      "referral",
      "other",
    ]),
    work_mode: z.enum(["remote", "hybrid", "on_site", "unknown"]),
    job_url: z
      .string()
      .max(2000)
      .refine((v) => !v || (/^https?:\/\//i.test(v) && URL.canParse(v))),
    location: text,
    country: text,
    industry: text,
    salary_text: text,
    salary_min: z.number().nonnegative().nullable(),
    salary_max: z.number().nonnegative().nullable(),
    salary_currency: z.string().max(10),
    match_score: z.number().min(0).max(100).nullable(),
    applied_at: z.string().date(),
    last_activity_at: z.string().datetime().nullable(),
    brief_description: text,
    job_description: text,
    notes: text,
    archived: z.boolean(),
    cv_id: z.string().uuid(),
    cv_file_path: z.string().max(2000).nullable(),
    cover_letter_file_path: z.string().max(2000).nullable(),
    cover_letter_draft: text,
  })
  .partial()
  .strict();
export async function POST(request: Request) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z
    .object({ id: z.string().uuid(), payload: schema })
    .strict()
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Dados inválidos. Confira os campos preenchidos." },
      { status: 400 },
    );
  const { id, payload } = parsed.data;
  const next: Record<string, unknown> = { ...payload };
  for (const key of ["cv_file_path", "cover_letter_file_path"] as const) {
    if (payload[key] && !payload[key]!.startsWith(user.id + "/"))
      return NextResponse.json(
        { error: "Arquivo indisponível." },
        { status: 403 },
      );
  }
  const { data: existing, error } = await db
    .from("job_applications")
    .select("id,ai_insights_json")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error)
    return NextResponse.json(
      { error: "Não foi possível carregar a candidatura." },
      { status: 500 },
    );
  if (!existing)
    return NextResponse.json(
      { error: "Candidatura não encontrada." },
      { status: 404 },
    );
  if (payload.cover_letter_draft !== undefined) {
    delete next.cover_letter_draft;
    next.ai_insights_json = {
      ...(existing.ai_insights_json || {}),
      cover_letter_draft: payload.cover_letter_draft,
    };
  }
  if (payload.cv_id) {
    const { data: cv, error: cvError } = await db
      .from("user_cvs")
      .select("id,name,file_path")
      .eq("id", payload.cv_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (cvError || !cv || !cv.file_path)
      return NextResponse.json({ error: "CV indisponível." }, { status: 404 });
    delete next.cv_id;
    next.cv_file_path = cv.file_path;
    next.ai_insights_json = {
      ...((next.ai_insights_json as Record<string, unknown>) ||
        existing.ai_insights_json ||
        {}),
      cv_version_id: cv.id,
      cv_version_name: cv.name,
    };
  }
  const result = await updateJobApplication(db, user.id, id, next);
  return NextResponse.json(
    result.ok ? { ok: true } : { error: "Não foi possível salvar os dados." },
    { status: result.ok ? 200 : 400 },
  );
}
