export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return {
    url,
    anon,
    ok: Boolean(url && anon)
  };
}

export function getSupabaseEnvOrThrow() {
  const { url, anon, ok } = getSupabaseEnv();
  if (!ok || !url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return { url, anon };
}
