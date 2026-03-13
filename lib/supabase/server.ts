import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getSupabaseEnvOrThrow } from "@/lib/supabase/env";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, anon } = getSupabaseEnvOrThrow();

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Ignore write attempts in Server Components.
          // Session refresh is handled by middleware.
        }
      }
    }
  });
}
