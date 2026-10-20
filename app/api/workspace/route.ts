import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { schemas, tables } from "@/lib/workspace/validation";
export const dynamic = "force-dynamic";
const envelope = z
  .object({
    resource: z.enum(["interviews", "actions", "stories", "links"]),
    id: z.string().uuid().optional(),
    data: z.unknown().optional(),
  })
  .strict();
async function mutate(request: Request, method: "POST" | "PATCH" | "DELETE") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = envelope.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const { resource, id } = parsed.data;
  if (method !== "POST" && !id)
    return NextResponse.json(
      { error: "Identificador necessário." },
      { status: 400 },
    );
  const table = tables[resource];
  if (method === "DELETE") {
    const { data, error } = await supabase
      .from(table)
      .delete()
      .eq("id", id!)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    return NextResponse.json(
      error
        ? { error: "Não foi possível excluir." }
        : data
          ? { ok: true }
          : { error: "Registro não encontrado." },
      { status: error ? 400 : data ? 200 : 404 },
    );
  }
  const values = schemas[resource].safeParse(parsed.data.data);
  if (!values.success)
    return NextResponse.json(
      { error: values.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  if (resource === "stories") {
    const s = values.data as z.infer<typeof schemas.stories>;
    if (
      s.status === "ready" &&
      ![s.situation, s.task, s.action, s.result].every(Boolean)
    )
      return NextResponse.json(
        {
          error: "Preencha as quatro partes STAR antes de marcar como pronta.",
        },
        { status: 400 },
      );
  }
  // RLS plus composite ownership foreign keys protect cross-account references.
  const query =
    method === "POST"
      ? supabase.from(table).insert({ ...values.data, user_id: user.id })
      : supabase
          .from(table)
          .update({ ...values.data, updated_at: new Date().toISOString() })
          .eq("id", id!)
          .eq("user_id", user.id);
  const { data, error } = await query.select("*").maybeSingle();
  return NextResponse.json(
    error
      ? {
          error:
            error.code === "23505"
              ? "Este vínculo já existe."
              : "Não foi possível salvar. Verifique os dados e a candidatura.",
        }
      : data
        ? { data }
        : { error: "Registro não encontrado." },
    { status: error ? 400 : data ? 200 : 404 },
  );
}
export const POST = (r: Request) => mutate(r, "POST");
export const PATCH = (r: Request) => mutate(r, "PATCH");
export const DELETE = (r: Request) => mutate(r, "DELETE");
