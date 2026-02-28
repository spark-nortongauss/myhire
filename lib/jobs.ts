import { differenceInCalendarDays } from "date-fns";
import type { Platform, WorkMode } from "@/types/db";

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
