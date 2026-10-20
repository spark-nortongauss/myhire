export type Interview = {
  id: string;
  job_application_id: string;
  interviewer: string;
  starts_at: string;
  duration_minutes: number;
  time_zone: string;
  meeting_url: string;
  notes: string;
  status: "scheduled" | "completed" | "cancelled";
};
export type Action = {
  id: string;
  job_application_id: string;
  title: string;
  due_at: string | null;
  waiting_on: "me" | "company";
  completed: boolean;
};
export type Story = {
  id: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  short_version: string;
  skills: string[];
  principles: string[];
  language: string;
  status: "draft" | "ready";
};
export type StoryLink = {
  id: string;
  job_application_id: string;
  story_id: string;
};
export const statusLabels: Record<string, string> = {
  not_applied: "Not Applied",
  applied: "Candidatura enviada",
  proposal: "Proposta inicial",
  interview: "Entrevista",
  offer: "Oferta",
  rejected: "Recusada",
  no_answer: "Sem resposta",
  withdrawn: "Retirada",
};
export const workLabels: Record<string, string> = {
  remote: "Remoto",
  hybrid: "Híbrido",
  on_site: "Presencial",
  unknown: "A confirmar",
};
export const isActiveJob = (job: { archived?: boolean; status: string }) =>
  !job.archived &&
  !["not_applied", "rejected", "withdrawn", "offer"].includes(job.status);
export const dateLabel = (
  value: string | null,
  timeZone = "Europe/Paris",
  time = false,
) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone,
        day: "2-digit",
        month: "short",
        ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
      }).format(new Date(value.length === 10 ? value + "T12:00:00Z" : value))
    : "Sem prazo";
export const safeWebUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
};
export function nextInterview(
  items: Interview[],
  jobId?: string,
  now = Date.now(),
) {
  return items
    .filter(
      (i) =>
        i.status === "scheduled" &&
        new Date(i.starts_at).getTime() >= now &&
        (!jobId || i.job_application_id === jobId),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
}
