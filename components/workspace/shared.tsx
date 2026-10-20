"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast-provider";
export function useMutation() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [busy, setBusy] = useState(false);
  async function save(
    resource: string,
    data: unknown,
    id?: string,
    remove = false,
  ) {
    setBusy(true);
    try {
      const response = await fetch("/api/workspace", {
        method: remove ? "DELETE" : id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource,
          ...(id ? { id } : {}),
          ...(!remove ? { data } : {}),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      router.refresh();
      pushToast(remove ? "Registro excluído." : "Salvo.");
      return true;
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Falha ao salvar.", "error");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { save, busy };
}
export function CompanyMark({ name }: { name: string }) {
  return (
    <span
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-sm font-bold tracking-tight"
      aria-hidden
    >
      {/amazon|aws/i.test(name)
        ? "aws"
        : /microsoft/i.test(name)
          ? "MS"
          : name.slice(0, 2).toUpperCase()}
    </span>
  );
}
