"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, ExternalLink, FileText, Pencil, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Stories } from "@/components/workspace/stories";
import { Actions } from "@/components/workspace/actions";
import { Interviews } from "@/components/workspace/interviews";
import { CompanyMark } from "@/components/workspace/shared";
import {
  Action,
  Interview,
  Story,
  StoryLink,
  dateLabel,
  statusLabels,
  workLabels,
  safeWebUrl,
} from "@/lib/workspace/types";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast-provider";
import { useCvs } from "@/lib/use-cvs";
const tabs = [
  ["overview", "Visão geral"],
  ["preparation", "Preparação"],
  ["documents", "Documentos"],
  ["history", "Histórico"],
];
export function JobDetailsClient({
  data,
  workspace,
  prepId,
  events,
}: {
  data: any;
  workspace: {
    interviews: Interview[];
    actions: Action[];
    stories: Story[];
    links: StoryLink[];
  };
  prepId: string | null;
  events: any[];
}) {
  const db = createClient(),
    router = useRouter();
  const { pushToast } = useToast();
  const { cvs, error: cvError } = useCvs();
  const [tab, setTab] = useState("overview"),
    [editing, setEditing] = useState(false),
    [form, setForm] = useState<any>({}),
    [busy, setBusy] = useState(false),
    [notes, setNotes] = useState(data.notes || ""),
    [letter, setLetter] = useState(
      data.ai_insights_json?.cover_letter_draft || "",
    ),
    [file, setFile] = useState<{ url: string; title: string } | null>(null),
    [cvId, setCvId] = useState("");
  useEffect(() => {
    setNotes(data.notes || "");
    setLetter(data.ai_insights_json?.cover_letter_draft || "");
  }, [data]);
  useEffect(() => {
    const value = new URLSearchParams(location.search).get("tab");
    if (tabs.some(([key]) => key === value)) setTab(value!);
  }, []);
  function changeTab(key: string) {
    setTab(key);
    const url = new URL(location.href);
    url.searchParams.set("tab", key);
    history.replaceState(null, "", url);
  }
  async function update(payload: any) {
    setBusy(true);
    try {
      const res = await fetch("/api/jobs/update-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: data.id, payload }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      pushToast("Candidatura atualizada.");
      router.refresh();
      return true;
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Erro ao salvar.", "error");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function preview(path: string, title: string) {
    const { data: signed, error } = await db.storage
      .from("job-files")
      .createSignedUrl(path, 120);
    if (error || !signed?.signedUrl)
      return pushToast("Não foi possível abrir o arquivo.", "error");
    setFile({ url: signed.signedUrl, title });
  }
  async function upload(file: File) {
    if (file.size > 5 * 1024 * 1024 || !/\.(pdf|docx?|txt)$/i.test(file.name))
      return pushToast("Use PDF, DOC, DOCX ou TXT de até 5 MB.", "error");
    setBusy(true);
    try {
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) throw new Error("Sessão expirada.");
      const path = `${user.id}/cover-letter/${data.id}/${crypto.randomUUID()}.${file.name.split(".").pop()}`;
      const { error } = await db.storage.from("job-files").upload(path, file);
      if (error) throw error;
      await update({ cover_letter_file_path: path });
    } catch {
      pushToast("Não foi possível enviar o arquivo.", "error");
    } finally {
      setBusy(false);
    }
  }
  const timeline = Array.isArray(data.ai_insights_json?.recruitment_timeline)
    ? data.ai_insights_json.recruitment_timeline
    : [];
  const contacts = Array.isArray(data.ai_insights_json?.recruiter_contacts)
    ? data.ai_insights_json.recruiter_contacts
    : [];
  return (
    <div className="space-y-6">
      <Link
        href="/jobs"
        className="text-sm text-muted-foreground hover:text-primary"
      >
        My Jobs / {data.company_name}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <CompanyMark name={data.company_name} />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
              {data.job_title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {data.company_name} · {data.location || "Localização a confirmar"}{" "}
              · {workLabels[data.work_mode] || "Regime a confirmar"}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="tag">
                {statusLabels[data.status] || data.status}
              </span>
              {data.archived && <span className="tag">Arquivada</span>}
              <span className="text-xs text-muted-foreground">
                Candidatura / contato em {dateLabel(data.applied_at)}
              </span>
              {safeWebUrl(data.job_url) && (
                <a
                  href={safeWebUrl(data.job_url)!}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-sm text-primary"
                >
                  Ver anúncio
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setForm({
              job_title: data.job_title,
              company_name: data.company_name,
              status: data.status,
              platform: data.platform || "other",
              work_mode: data.work_mode || "unknown",
              job_url: data.job_url || "",
              location: data.location || "",
              country: data.country || "",
              industry: data.industry || "",
              salary_text: data.salary_text || "",
              salary_min: data.salary_min ?? "",
              salary_max: data.salary_max ?? "",
              salary_currency: data.salary_currency || "EUR",
              match_score: data.match_score ?? "",
              applied_at: data.applied_at?.slice(0, 10) || "",
              last_activity_at: data.last_activity_at?.slice(0, 10) || "",
              brief_description: data.brief_description || "",
              job_description: data.job_description || "",
              archived: data.archived || false,
            });
            setEditing(true);
          }}
        >
          <Pencil size={15} />
          Editar
        </Button>
      </div>
      <div
        role="tablist"
        aria-label="Detalhes da candidatura"
        className="flex gap-6 overflow-x-auto border-b border-border"
      >
        {tabs.map(([key, label]) => (
          <button
            role="tab"
            id={`tab-${key}`}
            aria-controls={`panel-${key}`}
            aria-selected={tab === key}
            key={key}
            onClick={() => changeTab(key)}
            className="tab"
          >
            {label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]"
      >
        <div className="min-w-0 space-y-6">
          {tab === "overview" && (
            <>
              <section className="card">
                <h2 className="text-lg font-semibold">Sobre a oportunidade</h2>
                {data.ai_insights_json?.details_incomplete && (
                  <p className="mt-3 rounded-lg bg-primary/5 p-3 text-sm">
                    Informações parciais — aguardando detalhes da empresa.
                  </p>
                )}
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7">
                  {data.job_description ||
                    data.brief_description ||
                    "Descrição ainda não recebida."}
                </p>
                <dl className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
                  {[
                    ["Remuneração", data.salary_text || "A confirmar"],
                    ["Setor", data.industry || "A confirmar"],
                    ["País", data.country || "A confirmar"],
                    [
                      "Última interação",
                      data.last_activity_at
                        ? dateLabel(data.last_activity_at)
                        : "Não registrada",
                    ],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-muted-foreground">{k}</dt>
                      <dd className="mt-1 text-sm">{v}</dd>
                    </div>
                  ))}
                </dl>
              </section>
              <section className="card space-y-4">
                <h2 className="text-lg font-semibold">Notas privadas</h2>
                <label className="field">
                  <span className="sr-only">Notas privadas</span>
                  <Textarea
                    className="min-h-44"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                <Button
                  variant="outline"
                  disabled={busy || notes === (data.notes || "")}
                  onClick={() => update({ notes })}
                >
                  Salvar notas
                </Button>
              </section>
            </>
          )}
          {tab === "preparation" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">
                  Preparação para a entrevista
                </h2>
                {prepId ? (
                  <Link
                    className="secondary-link"
                    href={`/interview-prep/${prepId}`}
                  >
                    <Play size={16} />
                    Simular entrevista
                  </Link>
                ) : (
                  <Link className="secondary-link" href="/interview-prep">
                    Abrir simulações
                  </Link>
                )}
              </div>
              <Stories
                items={workspace.stories}
                links={workspace.links}
                jobId={data.id}
              />
              <Link
                href="/preparation"
                className="inline-flex items-center gap-2 text-sm text-primary"
              >
                <BookOpen size={17} />
                Abrir biblioteca STAR →
              </Link>
            </>
          )}
          {tab === "documents" && (
            <>
              <section className="card space-y-5">
                <h2 className="text-lg font-semibold">CV desta candidatura</h2>
                {data.cv_file_path ? (
                  <Button
                    variant="outline"
                    onClick={() =>
                      preview(data.cv_file_path, "CV da candidatura")
                    }
                  >
                    <FileText size={16} />
                    Abrir CV vinculado
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum CV vinculado.
                  </p>
                )}
                {cvError && <p className="text-sm text-danger">{cvError}</p>}
                <label className="field">
                  Selecionar versão salva
                  <Select
                    value={cvId}
                    onChange={(e) => setCvId(e.target.value)}
                  >
                    <option value="">Escolha um CV</option>
                    {cvs
                      .filter((cv) => cv.filePath)
                      .map((cv) => (
                        <option key={cv.id} value={cv.id}>
                          {cv.name}
                        </option>
                      ))}
                  </Select>
                </label>
                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={busy || !cvId}
                    onClick={() => {
                      const cv = cvs.find((c) => c.id === cvId);
                      if (cv) update({ cv_id: cv.id });
                    }}
                  >
                    Vincular CV
                  </Button>
                  <Link href="/files" className="secondary-link">
                    Gerenciar CVs
                  </Link>
                </div>
              </section>
              <section className="card space-y-4">
                <h2 className="text-lg font-semibold">Carta de apresentação</h2>
                {data.cover_letter_file_path && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      preview(
                        data.cover_letter_file_path,
                        "Carta de apresentação",
                      )
                    }
                  >
                    Abrir arquivo
                  </Button>
                )}
                <label className="field">
                  Enviar arquivo (até 5 MB)
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    disabled={busy}
                    onChange={(e) => {
                      if (e.target.files?.[0]) upload(e.target.files[0]);
                    }}
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={busy}
                    variant="outline"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const res = await fetch("/api/cover-letter", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            jobId: data.id,
                            ...(cvId ? { cvId } : {}),
                          }),
                        });
                        const b = await res.json();
                        if (!res.ok) throw new Error(b.error);
                        setLetter(b.letter);
                      } catch (e) {
                        pushToast(
                          e instanceof Error ? e.message : "Erro na geração.",
                          "error",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Gerar rascunho com IA
                  </Button>
                </div>
                <label className="field">
                  Rascunho
                  <Textarea
                    className="min-h-64"
                    value={letter}
                    onChange={(e) => setLetter(e.target.value)}
                  />
                </label>
                <Button
                  disabled={busy}
                  onClick={() => update({ cover_letter_draft: letter })}
                >
                  Salvar rascunho
                </Button>
              </section>
            </>
          )}
          {tab === "history" && (
            <section className="card space-y-5">
              <h2 className="text-lg font-semibold">Histórico do processo</h2>
              {timeline.length > 0 && (
                <ol className="space-y-3">
                  {timeline.map((stage: string, index: number) => (
                    <li
                      key={index}
                      className={`border-l-2 pl-4 text-sm ${index === data.ai_insights_json?.current_timeline_stage ? "border-primary font-semibold" : "border-border text-muted-foreground"}`}
                    >
                      {stage}
                    </li>
                  ))}
                </ol>
              )}
              <h3 className="border-t border-border pt-5 text-sm font-semibold">
                Atividades registradas
              </h3>
              {!events.length && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma atividade registrada.
                </p>
              )}
              {events.map((e) => (
                <div key={e.id} className="border-l-2 border-border pl-4">
                  <p className="text-xs text-muted-foreground">
                    {dateLabel(e.event_at, "Europe/Paris", true)}
                  </p>
                  <p className="mt-1 text-sm">
                    {(
                      {
                        record_created: "Candidatura registrada",
                        status_changed: "Etapa atualizada",
                        details_updated: "Dados da candidatura atualizados",
                      } as Record<string, string>
                    )[e.event_type] || e.event_type}
                  </p>
                  {e.payload?.status && (
                    <p className="text-xs text-muted-foreground">
                      {statusLabels[e.payload.status] || e.payload.status}
                    </p>
                  )}
                </div>
              ))}
            </section>
          )}
        </div>
        <aside className="space-y-6">
          <Interviews items={workspace.interviews} jobId={data.id} />
          <Actions items={workspace.actions} jobId={data.id} />
          {contacts.length > 0 && (
            <section className="card space-y-4">
              <h2 className="text-lg font-semibold">Recrutamento</h2>
              {contacts.map((c: any, i: number) => (
                <div key={i}>
                  <p className="text-sm font-medium">{c.name}</p>
                  {typeof c.email === "string" && (
                    <a
                      href={`mailto:${c.email}`}
                      className="break-all text-xs text-primary"
                    >
                      {c.email}
                    </a>
                  )}
                </div>
              ))}
            </section>
          )}
        </aside>
      </div>
      <Modal
        open={editing}
        title="Editar candidatura"
        onClose={() => setEditing(false)}
      >
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const payload = {
              ...form,
              salary_min:
                form.salary_min === "" ? null : Number(form.salary_min),
              salary_max:
                form.salary_max === "" ? null : Number(form.salary_max),
              match_score:
                form.match_score === "" ? null : Number(form.match_score),
              last_activity_at: form.last_activity_at
                ? form.last_activity_at + "T12:00:00Z"
                : null,
            };
            if (await update(payload)) setEditing(false);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["job_title", "Cargo"],
              ["company_name", "Empresa"],
              ["job_url", "URL do anúncio"],
              ["location", "Localização"],
              ["country", "País"],
              ["industry", "Setor"],
              ["salary_text", "Remuneração / observações"],
              ["salary_currency", "Moeda"],
              ["salary_min", "Mínimo"],
              ["salary_max", "Máximo"],
              ["match_score", "Compatibilidade (0–100)"],
              ["applied_at", "Data da candidatura / contato"],
              ["last_activity_at", "Última interação"],
            ].map(([key, label]) => (
              <label className="field" key={key}>
                {label}
                <Input
                  required={[
                    "job_title",
                    "company_name",
                    "applied_at",
                  ].includes(key)}
                  maxLength={key === "job_url" ? 2000 : undefined}
                  type={
                    key === "job_url"
                      ? "url"
                      : key.endsWith("_at")
                        ? "date"
                        : ["salary_min", "salary_max", "match_score"].includes(
                              key,
                            )
                          ? "number"
                          : "text"
                  }
                  value={form[key] || ""}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </label>
            ))}
            <label className="field">
              Etapa
              <Select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {Object.entries(statusLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="field">
              Regime
              <Select
                value={form.work_mode}
                onChange={(e) =>
                  setForm({ ...form, work_mode: e.target.value })
                }
              >
                {Object.entries(workLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="field">
              Origem
              <Select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
              >
                {[
                  "linkedin",
                  "indeed",
                  "apec",
                  "france_travail",
                  "welcome_to_the_jungle",
                  "glassdoor",
                  "company_website",
                  "referral",
                  "other",
                ].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
            </label>
          </div>
          <label className="field">
            Resumo
            <Textarea
              value={form.brief_description || ""}
              onChange={(e) =>
                setForm({ ...form, brief_description: e.target.value })
              }
            />
          </label>
          <label className="field">
            Descrição
            <Textarea
              className="min-h-40"
              value={form.job_description || ""}
              onChange={(e) =>
                setForm({ ...form, job_description: e.target.value })
              }
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form.archived}
              onChange={(e) => setForm({ ...form, archived: e.target.checked })}
            />
            Arquivada
          </label>
          <Button disabled={busy}>
            {busy ? "Salvando…" : "Salvar candidatura"}
          </Button>
        </form>
      </Modal>
      <Modal
        open={!!file}
        title={file?.title || "Arquivo"}
        onClose={() => setFile(null)}
      >
        {file && (
          <iframe
            title={file.title}
            src={file.url}
            className="h-[65vh] w-full rounded-lg border border-border"
          />
        )}
      </Modal>
    </div>
  );
}
