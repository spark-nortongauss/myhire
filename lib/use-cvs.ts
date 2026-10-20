"use client";

import { useCallback, useEffect, useState } from "react";
import type { CvVersion } from "@/lib/cvs";

export async function cvRequest(method: string, body?: unknown) {
  const response = await fetch("/api/cvs", { method, headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not load CV profiles.");
  return payload;
}

export function useCvs() {
  const [cvs, setCvs] = useState<CvVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    try { const data = await cvRequest("GET"); setCvs(data.cvs); setError(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load CV profiles."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { cvs, loading, error, reload };
}
