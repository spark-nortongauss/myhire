"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  LockKeyhole,
  Mail,
  Moon,
  Sun,
  Trophy,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { safeNext } from "@/lib/auth-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export default function LoginPage() {
  const db = useMemo(() => (getSupabaseEnv().ok ? createClient() : null), []);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [mode, setMode] = useState<"link" | "password">("link"),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [cooldown, setCooldown] = useState(0),
    [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("myhire-theme") === "dark";
    setDark(saved);
    document.documentElement.dataset.theme = saved ? "dark" : "light";
    if (new URLSearchParams(location.search).has("error"))
      setError(
        "Este link expirou, já foi usado ou foi aberto em outro navegador. Solicite um novo link aqui.",
      );
  }, []);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (busy || (mode === "link" && cooldown)) return;
    setError("");
    setBusy(true);
    try {
      if (!db)
        throw new Error(
          "Acesso indisponível. Tente novamente em alguns minutos.",
        );
      const next = safeNext(new URLSearchParams(location.search).get("next"));
      if (mode === "password") {
        const { error } = await db.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw new Error("E-mail ou senha inválidos.");
        window.location.assign(next);
      } else {
        const { error } = await db.auth.signInWithOtp({
          email: email.trim(),
          options: {
            shouldCreateUser: false,
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error)
          throw new Error(
            error.status === 429
              ? "Aguarde um minuto antes de solicitar outro link."
              : "Não foi possível enviar o link. Confira o e-mail da sua conta e tente novamente.",
          );
        setSent(true);
        setCooldown(60);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível acessar.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-layout">
      <section className="login-brand">
        <a href="/" className="flex items-center gap-3 text-3xl font-bold">
          <BriefcaseBusiness size={30} />
          MyHire
        </a>
        <div>
          <h1>Sua próxima oportunidade começa aqui.</h1>
          <p>
            Candidaturas, entrevistas e histórias.
            <br />
            Tudo em um só lugar.
          </p>
        </div>
        <div className="flex gap-10 text-sm">
          {[
            [BookOpen, "Organize."],
            [CalendarDays, "Prepare."],
            [Trophy, "Conquiste."],
          ].map(([Icon, text]: any) => (
            <div key={text} className="space-y-3">
              <Icon size={26} />
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="login-content">
        <Button
          variant="ghost"
          className="absolute right-6 top-6"
          aria-label="Alternar tema"
          onClick={() => {
            setDark(!dark);
            document.documentElement.dataset.theme = !dark ? "dark" : "light";
            localStorage.setItem("myhire-theme", !dark ? "dark" : "light");
          }}
        >
          {dark ? <Sun size={19} /> : <Moon size={19} />}
        </Button>
        <div className="card w-full max-w-md p-6 sm:p-10">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {sent ? <Mail /> : <LockKeyhole />}
          </div>
          <h2 className="text-center text-2xl font-bold">
            {sent ? "Confira seu e-mail" : "Bem-vindo ao MyHire"}
          </h2>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            {sent
              ? `Se o endereço ${email} estiver cadastrado, você receberá seu link de acesso.`
              : mode === "link"
                ? "Entre com seu e-mail. Sem precisar de senha."
                : "Entre com o e-mail e a senha da sua conta."}
          </p>
          <div className="my-7 flex justify-center gap-5 text-sm">
            <span
              className={
                !sent ? "font-semibold text-primary" : "text-muted-foreground"
              }
            >
              1 · E-mail
            </span>
            <span aria-hidden>—</span>
            <span
              className={
                sent ? "font-semibold text-primary" : "text-muted-foreground"
              }
            >
              2 · Acesso
            </span>
          </div>
          {sent ? (
            <div className="space-y-5">
              <p className="text-center text-sm">
                Clique no link do e-mail para entrar. Confira também sua pasta
                de spam e abra o link neste navegador.
              </p>
              <Button
                className="w-full"
                disabled={busy || cooldown > 0}
                onClick={() => submit()}
              >
                {cooldown
                  ? `Reenviar em ${cooldown}s`
                  : busy
                    ? "Enviando…"
                    : "Reenviar link"}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setSent(false);
                  setError("");
                }}
              >
                Alterar e-mail
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <label className="field">
                E-mail
                <Input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                />
              </label>
              {mode === "password" && (
                <label className="field">
                  Senha
                  <Input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
              )}
              <Button
                className="w-full"
                disabled={busy || (mode === "link" && cooldown > 0)}
              >
                {busy
                  ? "Aguarde…"
                  : mode === "link"
                    ? "Enviar link de acesso"
                    : "Entrar"}
                <ArrowRight size={17} />
              </Button>
              {mode === "link" && (
                <p className="text-center text-xs text-muted-foreground">
                  Você receberá um link de uso único para entrar.
                </p>
              )}
              <div className="border-t border-border pt-4 text-center">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-primary"
                  onClick={() => {
                    setMode(mode === "link" ? "password" : "link");
                    setError("");
                  }}
                >
                  {mode === "link"
                    ? "Entrar com senha"
                    : "Entrar com link de e-mail"}
                </Button>
              </div>
            </form>
          )}
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger"
            >
              {error}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
