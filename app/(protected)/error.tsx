"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="card">
      <h1 className="text-xl font-semibold">
        Não foi possível carregar esta tela.
      </h1>
      <p className="my-4 text-sm text-muted-foreground">
        Seus dados continuam salvos. Tente novamente em alguns instantes.
      </p>
      <Button onClick={reset}>Tentar novamente</Button>
    </section>
  );
}
