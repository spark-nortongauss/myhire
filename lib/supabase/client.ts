import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnvOrThrow } from "@/lib/supabase/env";

export function createClient() {
  const { url, anon } = getSupabaseEnvOrThrow();
  return createBrowserClient(url, anon);
}
