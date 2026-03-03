"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, FileUp, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast-provider";
import { EmptyState } from "@/components/ui/empty-state";

const cvStorageKey = "myhire-cv-versions";
const MAX_CV_BYTES = 5 * 1024 * 1024;

type CvVersion = { id: string; name: string; summary: string; skills: string; filePath?: string; isDefault?: boolean; createdAt: string };

export function MyFilesManager({ userId }: { userId: string }) {
  const supabase = createClient();
  const { pushToast } = useToast();
  const [rows, setRows] = useState<CvVersion[]>([]);
  const [form, setForm] = useState({ name: "", summary: "", skills: "" });
  const [newCvFile, setNewCvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const createFileInputRef = useRef<HTMLInputElement>(null);

  const validateCvFile = (file: File) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf") ? file.size > MAX_CV_BYTES ? "CV file must be 5MB or smaller." : null : "Only PDF files are allowed.";

  useEffect(() => {
    const stored = localStorage.getItem(cvStorageKey);
    if (stored) setRows(JSON.parse(stored));
  }, []);

  const saveRows = (next: CvVersion[]) => { setRows(next); localStorage.setItem(cvStorageKey, JSON.stringify(next)); };

  const simulateProgress = () => {
    setProgress(5);
    const timer = setInterval(() => setProgress((p) => Math.min(95, p + 12)), 180);
    return () => clearInterval(timer);
  };

  const addVersion = async () => {
    if (!form.name.trim() && !newCvFile) return;
    if (newCvFile) {
      const error = validateCvFile(newCvFile);
      if (error) return pushToast(error, "error");
    }
    const rowId = crypto.randomUUID();
    let filePath: string | undefined;
    if (newCvFile) {
      setUploading(true);
      const stop = simulateProgress();
      const path = `${userId}/cv-versions/${rowId}/${Date.now()}-${newCvFile.name}`;
      const { error } = await supabase.storage.from("job-files").upload(path, newCvFile, { upsert: true });
      stop();
      setUploading(false);
      setProgress(100);
      setTimeout(() => setProgress(0), 500);
      if (error) return pushToast(error.message, "error");
      filePath = path;
    }

    const fallbackName = newCvFile?.name.replace(/\.[^.]+$/, "") || "Uploaded CV";
    saveRows([{ id: rowId, name: form.name.trim() || fallbackName, summary: form.summary.trim(), skills: form.skills.trim(), filePath, isDefault: rows.length === 0, createdAt: new Date().toISOString() }, ...rows]);
    setForm({ name: "", summary: "", skills: "" });
    setNewCvFile(null);
    if (createFileInputRef.current) createFileInputRef.current.value = "";
    pushToast("CV version saved");
  };

  const setDefault = (id: string) => { saveRows(rows.map((row) => ({ ...row, isDefault: row.id === id }))); pushToast("Default CV updated"); };
  const removeRow = (id: string) => { const next = rows.filter((row) => row.id !== id); if (!next.some((row) => row.isDefault) && next[0]) next[0].isDefault = true; saveRows(next); pushToast("CV version deleted"); };

  const uploadCvFile = async (rowId: string, file: File) => {
    const errorText = validateCvFile(file);
    if (errorText) return pushToast(errorText, "error");
    setUploading(true);
    const stop = simulateProgress();
    const path = `${userId}/cv-versions/${rowId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("job-files").upload(path, file, { upsert: true });
    stop();
    setUploading(false);
    setProgress(100);
    setTimeout(() => setProgress(0), 500);
    if (error) return pushToast(error.message, "error");
    saveRows(rows.map((row) => (row.id === rowId ? { ...row, filePath: path } : row)));
    pushToast("CV uploaded");
  };

  const enrichedRows = useMemo(() => [...rows].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)), [rows]);

  return <div className="space-y-6">
    <div className="card border-indigo-100"><h1 className="text-2xl font-black">My Files · CV Version Control</h1><p className="mt-2 text-sm text-muted-foreground">Create CV versions once and pick one while adding each application.</p></div>

    <div className="card space-y-3">
      <h2 className="text-lg font-semibold">Create a new CV version</h2>
      <Input placeholder="Version name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <div className="rounded-xl border border-dashed border-border p-4" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (file) setNewCvFile(file); }}>
        <p className="mb-2 flex items-center gap-2 text-sm font-medium"><FileUp size={14} />Drag & drop CV (PDF) or browse</p>
        <input ref={createFileInputRef} type="file" accept="application/pdf,.pdf" className="w-full text-sm" onChange={(e) => setNewCvFile(e.target.files?.[0] || null)} />
        {newCvFile ? <p className="mt-2 text-xs text-emerald-700">Selected: {newCvFile.name}</p> : null}
      </div>
      <Textarea className="min-h-24" placeholder="Profile summary" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
      <Textarea className="min-h-20" placeholder="Core skills" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} />
      <Button onClick={() => void addVersion()} disabled={uploading || (!form.name.trim() && !newCvFile)}><Upload size={14} />Save CV Version</Button>
      {uploading ? <div className="space-y-1"><p className="text-sm text-muted-foreground">Uploading CV file...</p><div className="h-2 rounded-full bg-slate-200"><div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} /></div></div> : null}
    </div>

    {enrichedRows.length === 0 ? <EmptyState title="No CV versions yet" description="Upload your first CV profile to speed up AI matching." /> : <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-sm"><table className="w-full text-sm"><thead className="sticky top-0 bg-muted"><tr><th className="px-3 py-2 text-left">Version</th><th className="px-3 py-2 text-left">Summary</th><th className="px-3 py-2 text-left">Skills</th><th className="px-3 py-2 text-left">File</th><th className="px-3 py-2 text-left">Actions</th></tr></thead><tbody>{enrichedRows.map((row) => <tr key={row.id} className="border-t border-border"><td className="px-3 py-2 font-medium">{row.name} {row.isDefault ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Default</span> : null}<p className="text-xs text-muted-foreground">Updated {new Date(row.createdAt).toLocaleDateString()}</p></td><td className="max-w-md px-3 py-2 text-slate-700">{row.summary || "-"}</td><td className="px-3 py-2 text-slate-700">{row.skills || "-"}</td><td className="px-3 py-2">{row.filePath ? <p className="flex items-center gap-1 text-xs font-medium text-emerald-700"><CheckCircle2 size={13} />Uploaded</p> : <input type="file" accept="application/pdf,.pdf" className="w-56 text-xs" onChange={(e) => e.target.files?.[0] && uploadCvFile(row.id, e.target.files[0])} />}</td><td className="px-3 py-2"><div className="flex gap-2"><Button variant="outline" onClick={() => setDefault(row.id)}>Set default</Button><Button variant="danger" onClick={() => removeRow(row.id)}>Delete</Button></div></td></tr>)}</tbody></table></div>}
  </div>;
}
