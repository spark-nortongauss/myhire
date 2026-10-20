"use client";
import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { useMutation } from "./shared";
import { zonedInstant } from "@/lib/workspace/time";
import { Action, dateLabel } from "@/lib/workspace/types";
const values = (a: Action) => ({
  job_application_id: a.job_application_id,
  title: a.title,
  due_at: a.due_at,
  waiting_on: a.waiting_on,
  completed: a.completed,
});
export function Actions({
  items,
  jobId,
  jobs = [],
}: {
  items: Action[];
  jobId?: string;
  jobs?: any[];
}) {
  const { save, busy } = useMutation();
  const [editing, setEditing] = useState<Partial<Action> | null>(null),
    [showDone, setShowDone] = useState(false);
  const pending = items.filter((a) => !a.completed),
    shown = showDone ? items : pending;
  return (
    <section className="card space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Próximas ações</h2>
        {jobId && (
          <Button
            variant="ghost"
            onClick={() =>
              setEditing({
                job_application_id: jobId,
                title: "",
                due_at: null,
                waiting_on: "me",
                completed: false,
              })
            }
          >
            <Plus size={16} />
            Adicionar
          </Button>
        )}
      </div>
      {!shown.length && (
        <p className="text-sm text-muted-foreground">
          Nenhuma ação pendente.{jobId ? " Adicione seu próximo passo." : ""}
        </p>
      )}
      <div className="divide-y divide-border">
        {shown.map((a) => (
          <div key={a.id} className="flex items-start gap-3 py-3">
            <input
              className="mt-1 h-4 w-4 accent-primary"
              type="checkbox"
              aria-label={`Concluir: ${a.title}`}
              checked={a.completed}
              disabled={busy}
              onChange={() =>
                save("actions", { ...values(a), completed: !a.completed }, a.id)
              }
            />
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm ${a.completed ? "line-through text-muted-foreground" : ""}`}
              >
                {a.title}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {!jobId && (
                  <Link
                    href={`/jobs/${a.job_application_id}`}
                    className="hover:underline"
                  >
                    {
                      jobs.find((j) => j.id === a.job_application_id)
                        ?.company_name
                    }{" "}
                    ·{" "}
                  </Link>
                )}
                {a.waiting_on === "company" ? "Aguardando empresa" : "Sua ação"}
                {a.due_at && (
                  <>
                    {" "}
                    ·{" "}
                    <span
                      className={
                        !a.completed && Date.parse(a.due_at) < Date.now()
                          ? "text-danger"
                          : ""
                      }
                    >
                      {dateLabel(a.due_at)}
                    </span>
                  </>
                )}
              </p>
            </div>
            <Button
              variant="ghost"
              className="shrink-0 px-2"
              aria-label={`Editar ação ${a.title}`}
              onClick={() => setEditing(a)}
            >
              <Pencil size={14} />
            </Button>
          </div>
        ))}
      </div>
      {items.some((a) => a.completed) && (
        <Button variant="ghost" onClick={() => setShowDone(!showDone)}>
          {showDone ? "Ocultar concluídas" : "Ver concluídas"}
        </Button>
      )}
      <Modal
        open={!!editing}
        title={editing?.id ? "Editar ação" : "Nova ação"}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await save("actions", values(editing as Action), editing.id))
                setEditing(null);
            }}
          >
            <label className="field">
              Próximo passo
              <Input
                required
                maxLength={250}
                value={editing.title}
                onChange={(e) =>
                  setEditing({ ...editing, title: e.target.value })
                }
              />
            </label>
            <label className="field">
              Depende de
              <Select
                value={editing.waiting_on}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    waiting_on: e.target.value as Action["waiting_on"],
                  })
                }
              >
                <option value="me">Mim</option>
                <option value="company">Empresa / recrutador</option>
              </Select>
            </label>
            <label className="field">
              Prazo (opcional)
              <Input
                type="date"
                value={editing.due_at?.slice(0, 10) || ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    due_at: e.target.value
                      ? zonedInstant(e.target.value + "T23:59", "Europe/Paris")
                      : null,
                  })
                }
              />
            </label>
            <div className="flex justify-between gap-2">
              {editing.id && (
                <Button
                  variant="ghost"
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      confirm("Excluir esta ação?") &&
                      (await save("actions", null, editing.id, true))
                    )
                      setEditing(null);
                  }}
                >
                  <Trash2 size={16} />
                  Excluir
                </Button>
              )}
              <Button disabled={busy}>
                {busy ? "Salvando…" : "Salvar ação"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}
