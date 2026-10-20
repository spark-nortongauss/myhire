"use client";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Link2,
  Pencil,
  Play,
  Plus,
  Search,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import type { Story, StoryLink } from "@/lib/workspace/types";
import { useMutation } from "./shared";
const blank: Omit<Story, "id"> = {
  title: "",
  situation: "",
  task: "",
  action: "",
  result: "",
  short_version: "",
  skills: [],
  principles: [],
  language: "pt",
  status: "draft",
};
const sections = [
  ["situation", "Situação", "Contexto, desafio e cenário."],
  ["task", "Tarefa", "Sua responsabilidade e o objetivo."],
  ["action", "Ação", "O que você fez, suas decisões e os obstáculos."],
  ["result", "Resultado", "Impacto, métricas verificadas e aprendizados."],
  [
    "short_version",
    "Versão curta",
    "Resumo para contar em cerca de dois minutos.",
  ],
] as const;
function values(s: Partial<Story>) {
  return {
    title: s.title,
    situation: s.situation,
    task: s.task,
    action: s.action,
    result: s.result,
    short_version: s.short_version,
    skills: s.skills,
    principles: s.principles,
    language: s.language,
    status: s.status,
  };
}
export function Stories({
  items,
  links = [],
  jobId,
}: {
  items: Story[];
  links?: StoryLink[];
  jobId?: string;
}) {
  const { save, busy } = useMutation();
  const [query, setQuery] = useState(""),
    [editing, setEditing] = useState<Partial<Story> | null>(null),
    [linking, setLinking] = useState(false),
    [chosen, setChosen] = useState(""),
    [expanded, setExpanded] = useState(""),
    [practice, setPractice] = useState<Story | null>(null),
    [seconds, setSeconds] = useState(0),
    [running, setRunning] = useState(false),
    [skills, setSkills] = useState(""),
    [principles, setPrinciples] = useState("");
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  const shown = items.filter(
    (s) =>
      (!jobId ||
        links.some(
          (l) => l.story_id === s.id && l.job_application_id === jobId,
        )) &&
      [s.title, ...s.skills, ...s.principles]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const available = items.filter(
    (s) =>
      !links.some((l) => l.story_id === s.id && l.job_application_id === jobId),
  );
  function edit(s?: Story) {
    setEditing(s || blank);
    setSkills(s?.skills.join(", ") || "");
    setPrinciples(s?.principles.join(", ") || "");
  }
  return (
    <section className="card space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BookOpen size={20} />
            Histórias STAR
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {jobId
              ? "Experiências selecionadas para esta candidatura."
              : "Seu repertório de experiências, reutilizável em cada processo."}
          </p>
        </div>
        <div className="flex gap-2">
          {jobId && (
            <Button
              variant="outline"
              onClick={() => {
                setChosen(available[0]?.id || "");
                setLinking(true);
              }}
            >
              <Link2 size={15} />
              Vincular
            </Button>
          )}
          <Button onClick={() => edit()}>
            <Plus size={16} />
            Nova história
          </Button>
        </div>
      </div>
      {!jobId && (
        <label className="relative block">
          <Search
            size={16}
            className="absolute left-3 top-3 text-muted-foreground"
          />
          <Input
            aria-label="Buscar histórias"
            className="pl-9"
            placeholder="Buscar por título, competência ou princípio"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      )}
      {!shown.length && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <BookOpen className="mx-auto mb-3 text-primary" />
          <p className="font-medium">
            {query
              ? "Nenhuma história encontrada"
              : jobId
                ? "Selecione suas histórias para esta vaga"
                : "Comece pelo que você já conquistou"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {jobId
              ? "Vincule uma história da biblioteca ou crie uma nova."
              : "Registre contexto, responsabilidade, ação e resultado. Você poderá vincular a história a várias vagas."}
          </p>
        </div>
      )}
      <div className="space-y-3">
        {shown.map((s) => (
          <article key={s.id} className="rounded-lg border border-border">
            <button
              className="flex w-full items-start justify-between gap-4 p-4 text-left"
              aria-expanded={expanded === s.id}
              onClick={() => setExpanded(expanded === s.id ? "" : s.id)}
            >
              <div>
                <h3 className="text-sm font-semibold">{s.title}</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[...s.skills, ...s.principles].map((t, i) => (
                    <span
                      key={i}
                      className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <span className="tag shrink-0">
                {s.status === "ready" ? "Pronta" : "Rascunho"}
              </span>
            </button>
            {expanded === s.id && (
              <div className="space-y-4 border-t border-border p-4">
                {sections.map(
                  ([k, label]) =>
                    s[k] && (
                      <div key={k}>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {label}
                        </h4>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                          {s[k]}
                        </p>
                      </div>
                    ),
                )}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => edit(s)}>
                    <Pencil size={14} />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPractice(s);
                      setSeconds(0);
                      setRunning(false);
                    }}
                  >
                    <Play size={14} />
                    Praticar
                  </Button>
                  {jobId && (
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        save(
                          "links",
                          null,
                          links.find(
                            (l) =>
                              l.story_id === s.id &&
                              l.job_application_id === jobId,
                          )?.id,
                          true,
                        )
                      }
                    >
                      <Unlink size={14} />
                      Desvincular
                    </Button>
                  )}
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
      <Modal
        open={!!editing}
        title={editing?.id ? "Editar história STAR" : "Nova história STAR"}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await save(
                  "stories",
                  {
                    ...values(editing),
                    skills: skills
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                    principles: principles
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                  editing.id,
                )
              )
                setEditing(null);
            }}
          >
            <label className="field">
              Título
              <Input
                required
                maxLength={250}
                value={editing.title}
                onChange={(e) =>
                  setEditing({ ...editing, title: e.target.value })
                }
              />
            </label>
            {sections.map(([key, label, placeholder]) => (
              <label key={key} className="field">
                {label}
                <Textarea
                  className="min-h-24"
                  value={editing[key]}
                  placeholder={placeholder}
                  onChange={(e) =>
                    setEditing({ ...editing, [key]: e.target.value })
                  }
                />
              </label>
            ))}
            <label className="field">
              Competências (separadas por vírgula)
              <Input
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="Liderança, eficiência operacional"
              />
            </label>
            <label className="field">
              Princípios / valores da empresa
              <Input
                value={principles}
                onChange={(e) => setPrinciples(e.target.value)}
                placeholder="Ownership, Invent and Simplify"
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="field">
                Idioma
                <Select
                  value={editing.language}
                  onChange={(e) =>
                    setEditing({ ...editing, language: e.target.value })
                  }
                >
                  <option value="pt">Português</option>
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                </Select>
              </label>
              <label className="field">
                Status
                <Select
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      status: e.target.value as Story["status"],
                    })
                  }
                >
                  <option value="draft">Rascunho</option>
                  <option value="ready">Pronta</option>
                </Select>
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Salva na biblioteca para reutilizar em qualquer candidatura.
              {jobId
                ? " Depois, use Vincular para selecionar esta história."
                : ""}
            </p>
            <div className="flex justify-between">
              {editing.id && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      confirm(
                        "Excluir esta história da biblioteca e de todas as vagas vinculadas?",
                      ) &&
                      (await save("stories", null, editing.id, true))
                    )
                      setEditing(null);
                  }}
                >
                  Excluir história
                </Button>
              )}
              <Button disabled={busy}>
                {busy ? "Salvando…" : "Salvar história"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
      <Modal
        open={linking}
        title="Vincular história à candidatura"
        onClose={() => setLinking(false)}
      >
        {available.length ? (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await save("links", {
                  job_application_id: jobId,
                  story_id: chosen,
                })
              )
                setLinking(false);
            }}
          >
            <label className="field">
              História
              <Select
                value={chosen}
                onChange={(e) => setChosen(e.target.value)}
              >
                {available.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </Select>
            </label>
            <Button disabled={busy || !chosen}>Vincular história</Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            Não há histórias disponíveis. Crie uma nova história ou acesse as já
            vinculadas.
          </p>
        )}
      </Modal>
      <Modal
        open={!!practice}
        title={`Praticar: ${practice?.title || ""}`}
        onClose={() => {
          setPractice(null);
          setRunning(false);
        }}
      >
        {practice && (
          <div className="space-y-5">
            <p
              className="text-center text-4xl font-semibold tabular-nums"
              aria-label="Tempo de prática"
            >
              {Math.floor(seconds / 60)
                .toString()
                .padStart(2, "0")}
              :{(seconds % 60).toString().padStart(2, "0")}
            </p>
            <p className="text-center text-sm text-muted-foreground">
              Conte sua história em voz alta. Referência: cerca de 2 minutos.
            </p>
            <div className="flex justify-center gap-2">
              <Button onClick={() => setRunning(!running)}>
                {running ? "Pausar" : "Iniciar"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setRunning(false);
                  setSeconds(0);
                }}
              >
                Reiniciar
              </Button>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {practice.short_version ||
                sections
                  .slice(0, 4)
                  .map(([k, l]) => `${l}: ${practice[k]}`)
                  .join("\n\n")}
            </p>
            <p className="text-xs text-muted-foreground">
              Prática pessoal com cronômetro. Nenhum áudio é gravado.
            </p>
          </div>
        )}
      </Modal>
    </section>
  );
}
