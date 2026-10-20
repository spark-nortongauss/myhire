import { createClient } from "@/lib/supabase/server";
import type { Action, Interview, Story, StoryLink } from "./types";
export async function getWorkspace(jobId?: string) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const scoped = (table: string) => {
    const q = db.from(table).select("*").eq("user_id", user.id);
    return jobId ? q.eq("job_application_id", jobId) : q;
  };
  const results = await Promise.all([
    scoped("job_interviews").order("starts_at"),
    scoped("job_actions").order("created_at"),
    db
      .from("star_stories")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    scoped("job_star_stories"),
  ]);
  if (results.some((r) => r.error))
    throw new Error(
      "Não foi possível carregar sua preparação. Tente novamente.",
    );
  return {
    interviews: results[0].data as Interview[],
    actions: results[1].data as Action[],
    stories: results[2].data as Story[],
    links: results[3].data as StoryLink[],
  };
}
