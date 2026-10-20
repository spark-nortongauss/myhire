"use client";
import { useState } from "react";
import { CalendarDays, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { Interview, dateLabel, safeWebUrl } from "@/lib/workspace/types";
import { wallTime, zonedInstant } from "@/lib/workspace/time";
import { useMutation } from "./shared";
export function Interviews({
  items,
  jobId,
}: {
  items: Interview[];
  jobId: string;
}) {
  const { save, busy } = useMutation();
  const [editing, setEditing] = useState<Partial<Interview> | null>(null),
    [local, setLocal] = useState(""),
    [error, setError] = useState("");
  function edit(i?: Interview) {
    setEditing(
      i || {
        job_application_id: jobId,
        interviewer: "",
        time_zone: "Europe/Paris",
        duration_minutes: 60,
        meeting_url: "",
        notes: "",
        status: "scheduled",
      },
    );
    setLocal(i ? wallTime(i.starts_at, i.time_zone) : "");
    setError("");
  }
  return (
    <section className="card space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarDays size={19} />
          Agenda
        </h2>
        <Button
          variant="ghost"
          aria-label="Agendar entrevista"
          onClick={() => edit()}
        >
          <Plus size={18} />
        </Button>
      </div>
      {!items.length && (
        <p className="text-sm text-muted-foreground">
          Nenhuma entrevista agendada.
        </p>
      )}
      <div className="space-y-5">
        {items.map((i) => (
          <div
            key={i.id}
            className={`border-l-2 pl-4 ${i.status === "scheduled" ? "border-primary/40" : "border-border opacity-60"}`}
          >
            <div className="flex justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">
                  {dateLabel(i.starts_at, i.time_zone, true)}
                </p>
                <p className="mt-1 text-sm">{i.interviewer}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {i.duration_minutes} min · {i.time_zone}
                </p>
              </div>
              <Button
                variant="ghost"
                className="px-2"
                aria-label={`Editar entrevista com ${i.interviewer}`}
                onClick={() => edit(i)}
              >
                <Pencil size={14} />
              </Button>
            </div>
            {i.status !== "scheduled" && (
              <span className="text-xs">
                {i.status === "completed" ? "Concluída" : "Cancelada"}
              </span>
            )}
            {i.notes && (
              <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                {i.notes}
              </p>
            )}
            {safeWebUrl(i.meeting_url) && (
              <a
                href={safeWebUrl(i.meeting_url)!}
                rel="noreferrer"
                target="_blank"
                className="mt-2 inline-block text-sm text-primary underline"
              >
                Abrir reunião ↗
              </a>
            )}
          </div>
        ))}
      </div>
      <Modal
        open={!!editing}
        title={editing?.id ? "Editar entrevista" : "Agendar entrevista"}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              try {
                const data = {
                  job_application_id: jobId,
                  interviewer: editing.interviewer,
                  starts_at: zonedInstant(local, editing.time_zone!),
                  duration_minutes: editing.duration_minutes,
                  time_zone: editing.time_zone,
                  meeting_url: editing.meeting_url,
                  notes: editing.notes,
                  status: editing.status,
                };
                if (await save("interviews", data, editing.id))
                  setEditing(null);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Data inválida.");
              }
            }}
          >
            <label className="field">
              Entrevistador / etapa
              <Input
                required
                value={editing.interviewer}
                onChange={(e) =>
                  setEditing({ ...editing, interviewer: e.target.value })
                }
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="field">
                Data e hora
                <Input
                  type="datetime-local"
                  required
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                />
              </label>
              <label className="field">
                Fuso horário
                <Select
                  value={editing.time_zone}
                  onChange={(e) =>
                    setEditing({ ...editing, time_zone: e.target.value })
                  }
                >
                  {[
                    "Europe/Paris",
                    "Europe/London",
                    "America/Sao_Paulo",
                    "America/New_York",
                    "America/Los_Angeles",
                    "UTC",
                    ...(editing.time_zone &&
                    ![
                      "Europe/Paris",
                      "Europe/London",
                      "America/Sao_Paulo",
                      "America/New_York",
                      "America/Los_Angeles",
                      "UTC",
                    ].includes(editing.time_zone)
                      ? [editing.time_zone]
                      : []),
                  ].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </label>
              <label className="field">
                Duração em minutos
                <Input
                  type="number"
                  min={5}
                  max={480}
                  required
                  value={editing.duration_minutes}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      duration_minutes: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="field">
                Status
                <Select
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      status: e.target.value as Interview["status"],
                    })
                  }
                >
                  <option value="scheduled">Agendada</option>
                  <option value="completed">Concluída</option>
                  <option value="cancelled">Cancelada</option>
                </Select>
              </label>
            </div>
            <label className="field">
              Link da reunião
              <Input
                type="url"
                value={editing.meeting_url}
                onChange={(e) =>
                  setEditing({ ...editing, meeting_url: e.target.value })
                }
              />
            </label>
            <label className="field">
              Observações
              <Textarea
                value={editing.notes}
                onChange={(e) =>
                  setEditing({ ...editing, notes: e.target.value })
                }
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <div className="flex justify-between">
              {editing.id && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      confirm("Excluir esta entrevista?") &&
                      (await save("interviews", null, editing.id, true))
                    )
                      setEditing(null);
                  }}
                >
                  Excluir
                </Button>
              )}
              <Button disabled={busy}>
                {busy ? "Salvando…" : "Salvar entrevista"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}
