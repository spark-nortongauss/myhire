import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace/data";
import { dateLabel, isActiveJob } from "@/lib/workspace/types";
import { CompanyMark } from "@/components/workspace/shared";
import { Actions } from "@/components/workspace/actions";
export default async function DashboardPage() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  const [result, workspace, profile] = await Promise.all([
    db
      .from("job_applications")
      .select("*")
      .eq("user_id", user!.id)
      .eq("archived", false),
    getWorkspace(),
    db
      .from("user_profiles")
      .select("full_name")
      .eq("id", user!.id)
      .maybeSingle(),
  ]);
  if (result.error)
    throw new Error("Não foi possível carregar suas candidaturas.");
  const jobs = result.data || [],
    active = jobs.filter(isActiveJob),
    activeIds = new Set(active.map((j) => j.id));
  const upcoming = workspace.interviews.filter(
    (i) =>
      i.status === "scheduled" &&
      Date.parse(i.starts_at) >= Date.now() &&
      activeIds.has(i.job_application_id),
  );
  const next = upcoming[0],
    job = next ? jobs.find((j) => j.id === next.job_application_id) : null;
  const actions = workspace.actions.filter((a) =>
    activeIds.has(a.job_application_id),
  );
  const name = profile.data?.full_name?.split(" ")[0] || "bem-vindo";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Olá, {name}</h1>
          <p className="page-subtitle">Seu próximo passo, com clareza.</p>
        </div>
        <Link href="/jobs?new=1" className="primary-link">
          + Nova candidatura
        </Link>
      </div>
      <div className="card grid grid-cols-1 gap-5 sm:grid-cols-3 sm:divide-x sm:divide-border">
        {[
          [BriefcaseBusiness, active.length, "candidaturas ativas"],
          [CalendarDays, upcoming.length, "entrevistas agendadas"],
          [
            Building2,
            new Set(active.map((j) => j.company_name)).size,
            "empresas",
          ],
        ].map(([Icon, n, label]: any) => (
          <div key={label} className="flex items-center gap-4 sm:px-4">
            <span className="rounded-full bg-primary/10 p-3 text-primary">
              <Icon size={22} />
            </span>
            <div>
              <p className="text-2xl font-bold">{n}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="space-y-6">
          <section className="card space-y-6">
            <p className="text-xs font-semibold tracking-wide text-primary">
              PRÓXIMA ENTREVISTA
            </p>
            {next && job ? (
              <>
                <div className="flex items-start gap-4">
                  <CompanyMark name={job.company_name} />
                  <div>
                    <h2 className="text-xl font-bold">{job.job_title}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {job.company_name}
                    </p>
                    <p className="mt-4 flex items-center gap-2 text-sm">
                      <CalendarDays size={17} />
                      {dateLabel(next.starts_at, next.time_zone, true)} ·{" "}
                      {next.duration_minutes} min
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {next.interviewer} · {next.time_zone}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/jobs/${job.id}?tab=preparation`}
                    className="primary-link"
                  >
                    Preparar entrevista
                  </Link>
                  <Link href={`/jobs/${job.id}`} className="secondary-link">
                    Ver candidatura
                  </Link>
                </div>
              </>
            ) : (
              <div>
                <h2 className="text-lg font-semibold">
                  Seu próximo encontro aparecerá aqui.
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Abra uma candidatura para adicionar entrevistas e organizar a
                  preparação.
                </p>
                <Link href="/jobs" className="mt-4 secondary-link">
                  Ver candidaturas
                </Link>
              </div>
            )}
          </section>
          <Actions items={actions} jobs={jobs} />
          <Link href="/preparation" className="card flex items-center gap-4">
            <BookOpen className="text-primary" />
            <div className="flex-1">
              <h2 className="font-semibold">Histórias STAR</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {workspace.stories.length
                  ? `${workspace.stories.length} histórias na sua biblioteca.`
                  : "Seu repertório de experiências para as entrevistas."}
              </p>
            </div>
            <ArrowRight className="text-primary" />
          </Link>
        </div>
        <section className="card">
          <h2 className="mb-6 text-xl font-semibold">Agenda</h2>
          {!upcoming.length && (
            <p className="text-sm text-muted-foreground">
              Nenhuma entrevista futura.
            </p>
          )}
          <div className="space-y-6">
            {upcoming.map((i) => (
              <Link
                key={i.id}
                href={`/jobs/${i.job_application_id}?tab=preparation`}
                className="block border-l-2 border-primary/25 pl-4 hover:border-primary"
              >
                <p className="text-xs font-semibold text-primary">
                  {dateLabel(i.starts_at, i.time_zone, true)}
                </p>
                <p className="mt-2 text-sm font-medium">{i.interviewer}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {
                    jobs.find((j) => j.id === i.job_application_id)
                      ?.company_name
                  }
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {i.time_zone}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          Ver resultados da busca
        </summary>
        <div className="mt-3 flex flex-wrap gap-4 rounded-lg border border-border p-4">
          {[
            ["Enviadas", "applied"],
            ["Entrevistas", "interview"],
            ["Ofertas", "offer"],
            ["Recusadas", "rejected"],
            ["Sem resposta", "no_answer"],
          ].map(([label, status]) => (
            <span key={status}>
              {label}:{" "}
              <strong>{jobs.filter((j) => j.status === status).length}</strong>
            </span>
          ))}
        </div>
      </details>
    </div>
  );
}
