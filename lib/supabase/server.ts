import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnvOrThrow } from "@/lib/supabase/env";

export async function createClient() {
  const cookieStore = cookies();
  const { url, anon } = getSupabaseEnvOrThrow();

  return createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        cookieStore.set({ name, value, ...(options ?? {}) });
      },
      remove(name: string, options: Record<string, unknown>) {
        cookieStore.set({ name, value: "", ...(options ?? {}), maxAge: 0 });
      }
    }
  });
}
