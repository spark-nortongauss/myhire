"use client";

import { useRouter } from "next/navigation";
import { CompanyMark } from "@/components/workspace/shared";
import {
  Action,
  Interview,
  dateLabel,
  nextInterview,
  statusLabels,
  workLabels,
} from "@/lib/workspace/types";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCvs } from "@/lib/use-cvs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast-provider";
import Link from "next/link";

export function JobsTable({
  initialData,
  userId,
  interviews,
  actions,
}: {
  initialData: any[];
  userId: string;
  interviews: Interview[];
  actions: Action[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const supabase = createClient();
  const { pushToast } = useToast();
  const [data, setData] = useState<any[]>(initialData);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState({ title: "", company: "", status: "" });
  const [sortBy, setSortBy] = useState<
    "applied_at" | "job_title" | "company_name"
  >("applied_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [open, setOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<"url" | "manual">("url");
  const [sourceUrl, setSourceUrl] = useState("");
  const [pageContent, setPageContent] = useState("");
  const [selectedCvId, setSelectedCvId] = useState("");
  const { cvs: cvVersions, error: cvError } = useCvs();
  const [pending, setPending] = useState(false);
  const startTransition = async (action: () => Promise<unknown>) => {
    setPending(true);
    try {
      await action();
    } catch {
      setProcessingState("idle");
      pushToast("Não foi possível concluir. Tente novamente.", "error");
    } finally {
      setPending(false);
    }
  };
  const [duplicateWarn, setDuplicateWarn] = useState<any>(null);
  const [previewScore, setPreviewScore] = useState<number | null>(null);
  const [processingState, setProcessingState] = useState<
    "idle" | "processing" | "done"
  >("idle");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(location.search).get("new") === "1") setOpen(true);
  }, []);
  useEffect(() => setData(initialData), [initialData]);

  useEffect(() => {
    const defaultCv =
      cvVersions.find((item) => item.isDefault) ?? cvVersions[0];
    if (defaultCv) setSelectedCvId((previous) => previous || defaultCv.id);
  }, [cvVersions]);
  useEffect(() => {
    if (cvError) pushToast(cvError, "error");
  }, [cvError, pushToast]);
  const refresh = async () => {
    const { data: rows, error } = await supabase
      .from("v_job_applications_enriched")
      .select("*")
      .eq("user_id", userId)
      .order("applied_at", { ascending: false });
    if (error) return pushToast("Não foi possível atualizar a lista.", "error");
    setData(rows ?? []);
    setSelectedIds([]);
    router.refresh();
  };
  const deleteSelected = async () => {
    if (!selectedIds.length) return;
    const { error } = await supabase
      .from("job_applications")
      .delete()
      .in("id", selectedIds);
    if (error) return pushToast(error.message, "error");
    setData((prev) => prev.filter((row) => !selectedIds.includes(row.id)));
    setSelectedIds([]);
    pushToast("Applications deleted");
    setConfirmDeleteOpen(false);
  };

  const runImport = async (bypassDuplicateCheck = false) => {
    const selectedCv = cvVersions.find((item) => item.id === selectedCvId);
    const res = await fetch("/api/import", {
      method: "POST",
      body: JSON.stringify({
        url: sourceUrl,
        content: entryMode === "manual" ? pageContent : "",
        cvId: selectedCv?.id,
        bypassDuplicateCheck,
      }),
    });
    return { res, payload: await res.json(), selectedCv };
  };
  const previewImport = async () => {
    const selectedCv = cvVersions.find((item) => item.id === selectedCvId);
    const res = await fetch("/api/import", {
      method: "POST",
      body: JSON.stringify({
        url: sourceUrl,
        content: entryMode === "manual" ? pageContent : "",
        cvId: selectedCv?.id,
        previewOnly: true,
      }),
    });
    const payload = await res.json();
    if (!res.ok) return pushToast(payload.error || "Preview failed", "error");
    setPreviewScore(payload.preview?.matchScore ?? null);
    if (payload.preview?.duplicate) setDuplicateWarn(payload.preview);
  };
  const importText = async (bypassDuplicateCheck = false) => {
    if (!sourceUrl.trim()) return pushToast("Job URL is mandatory", "error");
    setProcessingState("processing");
    const { res, payload } = await runImport(bypassDuplicateCheck);
    if (!res.ok) {
      setProcessingState("idle");
      if (res.status === 409) return setDuplicateWarn(payload);
      return pushToast(payload.error || "AI import failed", "error");
    }
    setProcessingState("done");
    pushToast("Application created");
    setTimeout(() => {
      setOpen(false);
      setProcessingState("idle");
      setSourceUrl("");
      setPageContent("");
      setPreviewScore(null);
      setDuplicateWarn(null);
      refresh();
    }, 700);
  };
  const filteredData = useMemo(() => {
    const rows = data.filter(
      (row) =>
        Boolean(row.archived) === archived &&
        `${row.job_title} ${row.company_name}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        row.job_title?.toLowerCase().includes(filter.title.toLowerCase()) &&
        row.company_name
          ?.toLowerCase()
          .includes(filter.company.toLowerCase()) &&
        (!filter.status || row.status === filter.status),
    );
    return rows.sort((a, b) => {
      const left = a[sortBy] ?? "";
      const right = b[sortBy] ?? "";
      if (sortBy === "applied_at")
        return sortDir === "desc"
          ? new Date(right).getTime() - new Date(left).getTime()
          : new Date(left).getTime() - new Date(right).getTime();
      return sortDir === "desc"
        ? String(right).localeCompare(String(left))
        : String(left).localeCompare(String(right));
    });
  }, [data, filter, sortBy, sortDir, archived, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">My Jobs</h1>
          <p className="page-subtitle">
            Suas oportunidades. Próximos passos claros.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>+ Nova candidatura</Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="max-w-md"
          placeholder="Buscar empresa ou cargo"
          aria-label="Buscar empresa ou cargo"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button
          variant={archived ? "ghost" : "outline"}
          aria-pressed={!archived}
          onClick={() => setArchived(false)}
        >
          Em acompanhamento {data.filter((r) => !r.archived).length}
        </Button>
        <Button
          variant={archived ? "outline" : "ghost"}
          aria-pressed={archived}
          onClick={() => setArchived(true)}
        >
          Arquivadas
        </Button>
        <Button
          variant="ghost"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          Filtros
        </Button>
      </div>
      {filtersOpen && (
        <div className="grid gap-3 rounded-lg border border-border bg-panel p-4 sm:grid-cols-3">
          <label className="field">
            Etapa
            <Select
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            >
              <option value="">Todas</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          <label className="field">
            Ordenar por
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="applied_at">Data da candidatura</option>
              <option value="company_name">Empresa</option>
              <option value="job_title">Cargo</option>
            </Select>
          </label>
          <label className="field">
            Ordem
            <Select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value as any)}
            >
              <option value="desc">Decrescente</option>
              <option value="asc">Crescente</option>
            </Select>
          </label>
        </div>
      )}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-panel p-3">
          <span className="text-sm">{selectedIds.length} selecionadas</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                const { error } = await supabase
                  .from("job_applications")
                  .update({ archived: !archived })
                  .in("id", selectedIds);
                if (error) pushToast(error.message, "error");
                else refresh();
              }}
            >
              {archived ? "Restaurar" : "Arquivar"}
            </Button>
            <Button variant="ghost" onClick={() => setSelectedIds([])}>
              Limpar seleção
            </Button>
            <Button variant="danger" onClick={() => setConfirmDeleteOpen(true)}>
              Excluir
            </Button>
          </div>
        </div>
      )}
      {filteredData.length === 0 ? (
        <EmptyState
          title="Nenhuma candidatura encontrada"
          description="Ajuste os filtros ou adicione uma nova oportunidade."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-panel">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="w-10 p-4">
                  <span className="sr-only">Selecionar</span>
                </th>
                <th className="py-4 pr-4">Empresa e vaga</th>
                <th className="p-4">Etapa</th>
                <th className="p-4">Próximo passo</th>
                <th className="p-4">Última interação</th>
                <th>
                  <span className="sr-only">Abrir</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row) => {
                const next = nextInterview(interviews, row.id);
                const action = actions.find(
                  (a) => a.job_application_id === row.id && !a.completed,
                );
                return (
                  <tr
                    key={row.id}
                    className="border-t border-border hover:bg-muted/50"
                  >
                    <td className="p-4">
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${row.company_name}`}
                        checked={selectedIds.includes(row.id)}
                        onChange={(e) =>
                          setSelectedIds((prev) =>
                            e.target.checked
                              ? [...prev, row.id]
                              : prev.filter((id) => id !== row.id),
                          )
                        }
                      />
                    </td>
                    <td className="py-6 pr-4">
                      <Link
                        href={`/jobs/${row.id}`}
                        className="flex items-start gap-4"
                      >
                        <CompanyMark name={row.company_name} />
                        <div>
                          <p className="font-semibold">{row.company_name}</p>
                          <p className="mt-1">{row.job_title}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {row.location || "Localização a confirmar"} ·{" "}
                            {workLabels[row.work_mode] || "Regime a confirmar"}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="p-4">
                      <span className="tag">
                        {statusLabels[row.status] || row.status}
                      </span>
                    </td>
                    <td className="max-w-[240px] p-4">
                      {next ? (
                        <Link href={`/jobs/${row.id}?tab=preparation`}>
                          <p>
                            {dateLabel(next.starts_at, next.time_zone, true)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {next.interviewer} · Preparar
                          </p>
                        </Link>
                      ) : action ? (
                        <Link href={`/jobs/${row.id}`}>
                          <p>{action.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {action.waiting_on === "company"
                              ? "Aguardando empresa"
                              : "Sua ação"}
                            {action.due_at
                              ? " · " + dateLabel(action.due_at)
                              : ""}
                          </p>
                        </Link>
                      ) : (
                        <Link
                          href={`/jobs/${row.id}`}
                          className="text-muted-foreground"
                        >
                          Definir próximo passo
                        </Link>
                      )}
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {row.last_activity_at
                        ? dateLabel(row.last_activity_at)
                        : "Não registrada"}
                    </td>
                    <td className="pr-4">
                      <Link
                        href={`/jobs/${row.id}`}
                        aria-label={`Abrir ${row.company_name}`}
                        className="p-3"
                      >
                        →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
            {filteredData.length} candidaturas
          </div>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nova candidatura"
      >
        <div className="space-y-4">
          <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm">
            <button
              onClick={() => setEntryMode("url")}
              className={`rounded-md px-3 py-1 ${entryMode === "url" ? "bg-white shadow" : ""}`}
            >
              Importar por URL
            </button>
            <button
              onClick={() => setEntryMode("manual")}
              className={`rounded-md px-3 py-1 ${entryMode === "manual" ? "bg-white shadow" : ""}`}
            >
              Colar descrição
            </button>
          </div>
          <div className="grid gap-3">
            <Input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="URL da vaga (obrigatória)"
              required
            />
            {entryMode === "manual" ? (
              <Textarea
                value={pageContent}
                onChange={(e) => setPageContent(e.target.value)}
                className="min-h-44"
                placeholder="Cole a descrição da vaga."
              />
            ) : (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                Importe os dados do anúncio. Depois você poderá revisar e editar
                os campos.
              </p>
            )}
            <div>
              <p className="mb-1 text-sm font-medium">
                CV para esta candidatura
              </p>
              <Select
                value={selectedCvId}
                onChange={(e) => setSelectedCvId(e.target.value)}
              >
                <option value="">Sem CV selecionado</option>
                {cvVersions.map((cv) => (
                  <option key={cv.id} value={cv.id}>
                    {cv.name}
                    {cv.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </Select>
            </div>
            {previewScore != null ? (
              <p className="rounded bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700">
                Profile match score: {previewScore}%
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="ghost"
                onClick={() => startTransition(previewImport)}
                disabled={!sourceUrl.trim() || pending}
              >
                Ver compatibilidade / duplicatas
              </Button>
              <Button
                disabled={
                  pending ||
                  processingState === "processing" ||
                  !sourceUrl.trim() ||
                  (entryMode === "manual" && !pageContent.trim())
                }
                onClick={() => startTransition(() => importText(false))}
              >
                {pending || processingState === "processing"
                  ? "Analisando…"
                  : "Importar candidatura"}
              </Button>
            </div>
            {processingState === "processing" ? (
              <p className="animate-pulse text-center text-sm text-indigo-600">
                ✨ Processing your application...
              </p>
            ) : null}
            {processingState === "done" ? (
              <p className="flex items-center justify-center gap-1 text-sm font-medium text-emerald-600">
                <CheckCircle2 size={16} /> Candidatura adicionada!
              </p>
            ) : null}
          </div>
        </div>
      </Modal>
      <Modal
        open={Boolean(duplicateWarn)}
        onClose={() => setDuplicateWarn(null)}
        title="Possible duplicated job position"
      >
        <p className="text-sm text-slate-700">
          You are adding a duplicated job position.
        </p>
        {duplicateWarn?.duplicateOlderThan3Weeks ? (
          <p className="mt-2 text-sm text-amber-700">
            Last application was more than 3 weeks ago (
            {duplicateWarn?.duplicateAgeDays} days).
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDuplicateWarn(null)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setDuplicateWarn(null);
              startTransition(() => importText(true));
            }}
          >
            Add anyway
          </Button>
        </div>
      </Modal>
      <Modal
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title="Confirm delete"
      >
        <p className="text-sm text-slate-700">
          Delete {selectedIds.length} selected applications?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDeleteOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={deleteSelected}>
            Delete selected
          </Button>
        </div>
      </Modal>
    </div>
  );
}
