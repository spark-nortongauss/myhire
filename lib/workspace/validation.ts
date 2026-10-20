import { z } from "zod";
const text = z.string().trim().max(20000);
const title = z.string().trim().min(1).max(250);
const uuid = z.string().uuid();
const url = z
  .string()
  .max(2000)
  .refine(
    (v) => !v || (/^https?:\/\//i.test(v) && URL.canParse(v)),
    "Use uma URL http ou https.",
  );
const timezone = z.string().refine((v) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}, "Fuso horário inválido.");
export const schemas = {
  interviews: z
    .object({
      job_application_id: uuid,
      interviewer: title,
      starts_at: z.string().datetime({ offset: true }),
      duration_minutes: z.number().int().min(5).max(480),
      time_zone: timezone,
      meeting_url: url,
      notes: text,
      status: z.enum(["scheduled", "completed", "cancelled"]),
    })
    .strict(),
  actions: z
    .object({
      job_application_id: uuid,
      title,
      due_at: z.string().datetime({ offset: true }).nullable(),
      waiting_on: z.enum(["me", "company"]),
      completed: z.boolean(),
    })
    .strict(),
  stories: z
    .object({
      title,
      situation: text,
      task: text,
      action: text,
      result: text,
      short_version: text,
      skills: z.array(z.string().trim().min(1).max(100)).max(30),
      principles: z.array(z.string().trim().min(1).max(100)).max(30),
      language: z.enum(["pt", "en", "fr"]),
      status: z.enum(["draft", "ready"]),
    })
    .strict(),
  links: z.object({ job_application_id: uuid, story_id: uuid }).strict(),
};
export const tables = {
  interviews: "job_interviews",
  actions: "job_actions",
  stories: "star_stories",
  links: "job_star_stories",
} as const;
