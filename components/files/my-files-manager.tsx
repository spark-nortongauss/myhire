"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const cvStorageKey = "myhire-cv-versions";

type CvVersion = {
  id: string;
  name: string;
  summary: string;
  skills: string;
  filePath?: string;
  isDefault?: boolean;
  createdAt: string;
};

export function MyFilesManager({ userId }: { userId: string }) {
  const supabase = createClient();
  const [rows, setRows] = useState<CvVersion[]>([]);
  const [form, setForm] = useState({ name: "", summary: "", skills: "" });
  const [newCvFile, setNewCvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const createFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(cvStorageKey);
    if (!stored) return;
    setRows(JSON.parse(stored));
  }, []);

  const saveRows = (next: CvVersion[]) => {
    setRows(next);
    localStorage.setItem(cvStorageKey, JSON.stringify(next));
  };

  const addVersion = async () => {
    if (!form.name.trim() && !newCvFile) return;
    const rowId = crypto.randomUUID();
    let filePath: string | undefined;

    if (newCvFile) {
      setUploading(true);
      const path = `${userId}/cv-versions/${rowId}/${Date.now()}-${newCvFile.name}`;
      const { error } = await supabase.storage.from("job-files").upload(path, newCvFile, { upsert: true });
      setUploading(false);
      if (error) return alert(error.message);
      filePath = path;
    }

    const fallbackName = newCvFile?.name.replace(/\.[^.]+$/, "") || "Uploaded CV";
    const next: CvVersion[] = [
      {
        id: rowId,
        name: form.name.trim() || fallbackName,
        summary: form.summary.trim(),
        skills: form.skills.trim(),
        filePath,
        isDefault: rows.length === 0,
        createdAt: new Date().toISOString()
      },
      ...rows
    ];
    saveRows(next);
    setForm({ name: "", summary: "", skills: "" });
    setNewCvFile(null);
    if (createFileInputRef.current) createFileInputRef.current.value = "";
  };

  const setDefault = (id: string) => {
    saveRows(rows.map((row) => ({ ...row, isDefault: row.id === id })));
  };

  const removeRow = (id: string) => {
    const next = rows.filter((row) => row.id !== id);
    if (!next.some((row) => row.isDefault) && next[0]) next[0].isDefault = true;
    saveRows(next);
  };

  const uploadCvFile = async (rowId: string, file: File) => {
    setUploading(true);
    const path = `${userId}/cv-versions/${rowId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("job-files").upload(path, file, { upsert: true });
    setUploading(false);
    if (error) return alert(error.message);
    saveRows(rows.map((row) => (row.id === rowId ? { ...row, filePath: path } : row)));
  };

  const enrichedRows = useMemo(() => rows.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)), [rows]);

  return (
    <div className="space-y-6">
      <div className="card border-indigo-100">
        <h1 className="text-2xl font-bold">My Files · CV Version Control</h1>
        <p className="mt-2 text-sm text-muted-foreground">Create CV versions once and pick one while adding each application. No repetitive uploads.</p>
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">Create a new CV version</h2>
        <Input placeholder="Version name (e.g. Product Manager CV - Europe)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <div>
          <p className="mb-1 text-sm font-medium">Upload CV file (optional)</p>
          <input ref={createFileInputRef} type="file" className="w-full text-sm" onChange={(e) => setNewCvFile(e.target.files?.[0] || null)} />
          <p className="mt-1 text-xs text-muted-foreground">If you upload a file, we store it in the same job-files bucket location used for CV uploads.</p>
        </div>
        <Textarea
          className="min-h-24"
          placeholder="Profile summary used by AI matching (experience, domain, strengths)."
          value={form.summary}
          onChange={(e) => setForm({ ...form, summary: e.target.value })}
        />
        <Textarea className="min-h-20" placeholder="Core skills (comma separated)." value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} />
        <Button onClick={() => void addVersion()} disabled={uploading || (!form.name.trim() && !newCvFile)}>
          Save CV Version
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left">Version</th>
              <th className="px-3 py-2 text-left">Summary</th>
              <th className="px-3 py-2 text-left">Skills</th>
              <th className="px-3 py-2 text-left">File</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {enrichedRows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">
                  {row.name} {row.isDefault ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Default</span> : null}
                </td>
                <td className="max-w-md px-3 py-2 text-slate-700">{row.summary || "-"}</td>
                <td className="px-3 py-2 text-slate-700">{row.skills || "-"}</td>
                <td className="px-3 py-2">
                  <input type="file" className="w-56 text-xs" onChange={(e) => e.target.files?.[0] && uploadCvFile(row.id, e.target.files[0])} />
                  {row.filePath ? <p className="mt-1 text-xs text-emerald-700">Uploaded</p> : null}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setDefault(row.id)}>
                      Set default
                    </Button>
                    <Button variant="danger" onClick={() => removeRow(row.id)}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {uploading ? <p className="text-sm text-muted-foreground">Uploading CV file...</p> : null}
    </div>
  );
}
