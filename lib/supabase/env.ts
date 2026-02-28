// lib/supabase/env.ts
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return {
    url,
    anon,
    ok: Boolean(url && anon),
  };
}
