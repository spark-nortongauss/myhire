"use server";

import { createClient } from "@/lib/supabase/server";

export async function enforceOverdueRejections() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return;

  const thresholdDate = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();

  await supabase
    .from("job_applications")
    .update({ status: "rejected", status_updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .in("status", ["applied", "no_answer"])
    .lte("applied_at", thresholdDate);
}
