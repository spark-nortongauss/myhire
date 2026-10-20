"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseLegacyCvs, type CvVersion } from "@/lib/cvs";
import { cvRequest, useCvs } from "@/lib/use-cvs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast-provider";
import { EmptyState } from "@/components/ui/empty-state";

const legacyKey = "myhire-cv-versions";

export function MyFilesManager({ userId }: { userId: string }) {
  const { cvs, loading, error, reload } = useCvs();
  const { pushToast } = useToast();
  const [form, setForm] = useState({ name: "", summary: "", skills: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [legacy, setLegacy] = useState<CvVersion[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { setLegacy(parseLegacyCvs(localStorage.getItem(legacyKey), userId)); } catch { /* Storage may be disabled. */ }
  }, [userId]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try { await action(); await reload(); }
    catch (cause) { pushToast(cause instanceof Error ? cause.message : "Could not save CV.", "error"); }
    finally { setBusy(false); }
  };

  const upload = async (id: string, selected: File) => {
    if (!selected.name.toLowerCase().endsWith(".pdf") || (selected.type && selected.type !== "application/pdf")) throw new Error("Only PDF files are allowed.");
    if (selected.size > 5 * 1024 * 1024) throw new Error("CV file must be 5MB or smaller.");
    const filePath = `${userId}/cv-versions/${id}/${crypto.randomUUID()}.pdf`;
    const { error: uploadError } = await createClient().storage.from("job-files").upload(filePath, selected, { contentType: "application/pdf" });
    if (uploadError) throw new Error(uploadError.message);
    return { filePath, fileName: selected.name, fileSize: selected.size };
  };

  const add = () => run(async () => {
    const id = crypto.randomUUID();
    const attachment: { filePath?: string; fileName?: string; fileSize?: number } = file ? await upload(id, file) : {};
    try {
      const saved = await cvRequest("POST", { id, ...form, name: form.name.trim() || file?.name.replace(/\.pdf$/i, "") || "CV profile", ...attachment, isDefault: cvs.length === 0 });
      if (saved.warning) pushToast(saved.warning, "error");
    } catch (cause) {
      if (attachment.filePath) await createClient().storage.from("job-files").remove([attachment.filePath]);
      throw cause;
    }
    setForm({ name: "", summary: "", skills: "" }); setFile(null);
    if (inputRef.current) inputRef.current.value = "";
    pushToast("CV saved to your account");
  });

  const importLegacy = () => run(async () => {
    // Explicit import avoids silently assigning shared-browser profiles to the wrong account.
    const knownIds = new Set(cvs.map((cv) => cv.id));
    for (const cv of legacy) {
      if (!knownIds.has(cv.id)) await cvRequest("POST", { ...cv, isDefault: cvs.length === 0 && cv.isDefault });
    }
    const importedIds = new Set(legacy.map((cv) => cv.id));
    const original: unknown = JSON.parse(localStorage.getItem(legacyKey) || "[]");
    if (Array.isArray(original)) {
      const remaining = original.filter((cv) => !importedIds.has(cv?.id));
      if (remaining.length) localStorage.setItem(legacyKey, JSON.stringify(remaining));
      else localStorage.removeItem(legacyKey);
    }
    setLegacy([]); pushToast("Browser CV profiles imported into your account");
  });

  return <div className="space-y-6">
    <div className="card"><h1 className="text-2xl font-black">My Files · CV Version Control</h1><p className="mt-2 text-sm text-muted-foreground">CV profiles and files are saved to your account and available on every device.</p></div>
    {error ? <div role="alert" className="card text-red-700">{error} <Button variant="outline" onClick={() => void reload()}>Retry</Button></div> : null}
    {legacy.length ? <div className="card space-y-2 border-amber-300"><p>{legacy.length} CV profile(s) found in this browser. Import them if they belong to you.</p><Button onClick={importLegacy} disabled={busy || loading}>Import browser CV profiles</Button></div> : null}
    <div className="card space-y-3">
      <h2 className="text-lg font-semibold">Create a CV version</h2>
      <Input aria-label="Version name" placeholder="Version name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <label className="block text-sm">CV file (PDF, up to 5 MB)<input ref={inputRef} type="file" accept="application/pdf,.pdf" className="mt-2 block" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
      <Textarea aria-label="Profile summary" placeholder="Profile summary used for matching and cover letters" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
      <Textarea aria-label="Core skills" placeholder="Core skills, separated by commas" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} />
      <Button onClick={add} disabled={busy || loading || !!error || (!form.name.trim() && !file)}>{busy ? "Saving..." : "Save CV version"}</Button>
    </div>
    {loading ? <p role="status">Loading CV profiles...</p> : cvs.length === 0 ? <EmptyState title="No CV versions yet" description="Create your first CV profile to use it across applications and searches." /> :
      <div className="grid gap-3">{cvs.map((cv) => <article key={cv.id} className="card space-y-3">
        <h2 className="font-semibold">{cv.name} {cv.isDefault ? <span className="text-sm text-emerald-700">· Default</span> : null}</h2>
        <p className="whitespace-pre-wrap text-sm">{cv.summary || "No summary"}</p><p className="text-sm text-muted-foreground">{cv.skills || "No skills listed"}</p>
        {cv.filePath ? <Button variant="outline" onClick={() => run(async () => {
          const { data, error: linkError } = await createClient().storage.from("job-files").createSignedUrl(cv.filePath!, 120);
          if (linkError || !data?.signedUrl) throw new Error("Could not open CV file.");
          window.open(data.signedUrl, "_blank", "noopener,noreferrer");
        })}>Open {cv.fileName || "PDF"}</Button> : <label className="block text-sm">Attach PDF<input aria-label={`Attach PDF to ${cv.name}`} disabled={busy} type="file" accept="application/pdf,.pdf" className="block" onChange={(e) => {
          const selected = e.target.files?.[0]; if (!selected) return;
          void run(async () => { const attachment = await upload(cv.id, selected); try { await cvRequest("PATCH", { action: "attach-file", id: cv.id, ...attachment }); } catch (cause) { await createClient().storage.from("job-files").remove([attachment.filePath]); throw cause; } });
        }} /></label>}
        <div className="flex gap-2"><Button variant="outline" disabled={busy || cv.isDefault} onClick={() => run(async () => { await cvRequest("PATCH", { action: "set-default", id: cv.id }); })}>Set default</Button>
          <Button variant="danger" disabled={busy} onClick={() => { if (window.confirm("Delete this CV profile and its saved job searches? Files attached to applications will be kept.")) void run(async () => { await cvRequest("DELETE", { id: cv.id }); }); }}>Delete profile</Button></div>
      </article>)}</div>}
  </div>;
}
