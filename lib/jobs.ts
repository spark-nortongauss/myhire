import type { SupabaseClient } from "@supabase/supabase-js";
import { differenceInCalendarDays } from "date-fns";
import type { Platform, WorkMode } from "@/types/db";
import { ensureInterviewPrepForJob } from "@/lib/interview-prep/data";

export function inferPlatform(url: string): Platform {
  const lower = url.toLowerCase();
  if (lower.includes("linkedin")) return "linkedin";
  if (lower.includes("indeed")) return "indeed";
  if (lower.includes("wellfound") || lower.includes("angel.co")) return "wellfound";
  if (lower.includes("greenhouse") || lower.includes("lever")) return "other";
  return "other";
}

export function inferWorkMode(text: string): WorkMode | null {
  const lower = text.toLowerCase();
  if (lower.includes("hybrid")) return "hybrid";
  if (lower.includes("remote")) return "remote";
  if (lower.includes("on-site") || lower.includes("onsite")) return "on_site";
  return null;
}

export function isOverdue(appliedAt: string | null) {
  if (!appliedAt) return false;
  return differenceInCalendarDays(new Date(), new Date(appliedAt)) > 21;
}

type DBClient = SupabaseClient<any, "public", any>;

type UpdatePayload = Record<string, unknown>;

export async function updateJobApplication(supabase: DBClient, userId: string, jobId: string, payload: UpdatePayload) {
  if (!userId || !jobId) return { ok: false, error: "Missing identifiers" };

  const nextPayload = { ...payload };
  const urlValue = typeof nextPayload.job_url === "string" ? nextPayload.job_url.trim() : nextPayload.job_url;
  if (typeof urlValue === "string" && urlValue.length > 2048) {
    return { ok: false, error: "job_url is too long (max 2048 characters)" };
  }

  const { error } = await supabase.from("job_applications").update(nextPayload).eq("id", jobId).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  if (nextPayload.status === "interview") {
    await ensureInterviewPrepForJob(supabase, jobId, userId);
  }

  return { ok: true };
}
