"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FileText, FileUser, Pencil, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

const statusTone: Record<string, string> = {
  applied: "bg-blue-100 text-blue-700",
  proposal: "bg-violet-100 text-violet-700",
  interview: "bg-amber-100 text-amber-700",
  offer: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  no_answer: "bg-slate-200 text-slate-700"
};

const getRelativeDaysLabel = (days?: number | null, isOverdue?: boolean | null) => {
  if (days == null) return "Applied date not available";
  if (days === 0) return "Applied today";
  if (days === 1) return "Applied yesterday";
  return `${days} days since applying${isOverdue ? " • follow up recommended" : ""}`;
};

const toLabel = (value?: string | null) => {
  if (!value) return "Not specified";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

const getMatchScore = (data: any) => {
  const parsed = Number(data?.ai_insights_json?.match_score ?? data?.match_score ?? Number.NaN);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, Math.min(100, Math.round(parsed)));
};

export function JobDetailsClient({ data }: { data: any }) {
  const supabase = createClient();
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileTitle, setFileTitle] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(data.notes ?? "");
  const [draftNotes, setDraftNotes] = useState(data.notes ?? "");
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const dirtyRef = useRef(false);

  const matchScore = getMatchScore(data);
  const cvPath = data.cv_file_path || data.ai_insights_json?.cv_file_path || null;

  const summaryItems = useMemo(
    () => [
      { label: "Platform", value: toLabel(data.platform) },
      { label: "Work mode", value: toLabel(data.work_mode) },
      { label: "Industry", value: data.industry || "Not specified" },
      { label: "Location", value: data.location || "Not specified" },
      { label: "Last update", value: data.status_updated_at ? new Date(data.status_updated_at).toLocaleDateString() : "Not updated yet" },
      { label: "Applied", value: data.applied_at ? new Date(data.applied_at).toLocaleDateString() : "Not set" },
      { label: "CV version", value: data.ai_insights_json?.cv_version_name || "Default CV" }
    ],
    [data]
  );

  const openPreview = async (path: string, label: string) => {
    const { data: signed, error } = await supabase.storage.from("job-files").createSignedUrl(path, 120);
    if (error || !signed?.signedUrl) return alert(error?.message ?? "Failed to preview file");
    setFileUrl(signed.signedUrl);
    setFileTitle(label);
  };

  const saveNotes = async () => {
    const { error } = await supabase.from("job_applications").update({ notes: draftNotes }).eq("id", data.id);
    if (error) return alert(error.message);
    setNotes(draftNotes);
    setEditingNotes(false);
    dirtyRef.current = false;
  };

  const requestCancelNotes = () => {
    if (dirtyRef.current) return setConfirmCloseOpen(true);
    setEditingNotes(false);
    setDraftNotes(notes);
  };

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden p-0">
        <div className="bg-grid relative border-b border-border px-6 py-8">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-sky-500/10 to-violet-500/10" />
          <div className="relative space-y-4">
            <Link href="/jobs" className="text-sm font-medium text-indigo-700 hover:underline">
              ← Back to jobs
            </Link>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{data.company_name}</p>
                <h1 className="text-3xl font-bold tracking-tight">{data.job_title}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{getRelativeDaysLabel(data.days_since_applied, data.is_overdue)}</p>
              </div>
              <Badge className={statusTone[data.status] ?? "bg-muted"}>{toLabel(data.status)}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className={matchScore != null && matchScore >= 75 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                AI profile match: {matchScore == null ? "Not scored" : `${matchScore}%`}
              </Badge>
              {data.job_url ? (
                <a href={data.job_url} target="_blank" rel="noreferrer" className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white">
                  Open original listing
                </a>
              ) : null}
              <Button variant="ghost" className="rounded-full border bg-white/60" onClick={() => cvPath && openPreview(cvPath, "CV Preview")}>
                <FileUser size={16} className={cvPath ? "text-emerald-600" : "text-slate-500"} />
                <span className="ml-2 text-xs">{data.ai_insights_json?.cv_version_name || (cvPath ? "CV uploaded" : "CV not uploaded")}</span>
              </Button>
              <Button
                variant="ghost"
                className="rounded-full border bg-white/60"
                onClick={() => data.cover_letter_file_path && openPreview(data.cover_letter_file_path, "Cover Letter Preview")}
              >
                <FileText size={16} className={data.cover_letter_file_path ? "text-indigo-600" : "text-slate-500"} />
                <span className="ml-2 text-xs">{data.cover_letter_file_path ? "Cover letter uploaded" : "Cover letter not uploaded"}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {summaryItems.map((item) => (
          <div key={item.label} className="card">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
            <p className="mt-2 text-sm font-medium">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="card xl:col-span-2">
          <h2 className="mb-3 text-lg font-semibold">Job description</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{data.job_description || data.brief_description || "No description added yet."}</p>
        </div>
        <div className="card">
          <h2 className="mb-3 text-lg font-semibold">Compensation snapshot</h2>
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Range:</span> {data.salary_text || "Not provided"}
            </p>
            <p>
              <span className="font-medium">Minimum:</span> {data.salary_min ?? "-"}
            </p>
            <p>
              <span className="font-medium">Maximum:</span> {data.salary_max ?? "-"}
            </p>
            <p>
              <span className="font-medium">Currency:</span> {data.salary_currency || "-"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-lg font-semibold">AI insights</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{data.ai_insights || "No AI insights generated yet."}</p>
        </div>
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Private notes</h2>
            {!editingNotes ? (
              <Button variant="ghost" onClick={() => setEditingNotes(true)}>
                <Pencil size={14} className="mr-1" /> Edit
              </Button>
            ) : null}
          </div>
          {editingNotes ? (
            <>
              <Textarea
                className="min-h-36"
                value={draftNotes}
                onChange={(e) => {
                  setDraftNotes(e.target.value);
                  dirtyRef.current = e.target.value !== notes;
                }}
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={requestCancelNotes}>
                  Cancel
                </Button>
                <Button onClick={saveNotes}>
                  <Save size={14} className="mr-1" /> Save
                </Button>
              </div>
            </>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{notes || "No personal notes for this application yet."}</p>
          )}
        </div>
      </div>

      <Modal open={Boolean(fileUrl)} onClose={() => setFileUrl(null)} title={fileTitle}>
        {fileUrl ? <iframe src={fileUrl} className="h-[70vh] w-full rounded-md border" title={fileTitle} /> : null}
      </Modal>

      <Modal open={confirmCloseOpen} onClose={() => setConfirmCloseOpen(false)} title="Discard unsaved changes?">
        <p className="text-sm text-slate-600">You have unsaved edits in your private notes.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmCloseOpen(false)}>
            Keep editing
          </Button>
          <Button
            onClick={() => {
              setDraftNotes(notes);
              setConfirmCloseOpen(false);
              setEditingNotes(false);
              dirtyRef.current = false;
            }}
          >
            Cancel changes
          </Button>
        </div>
      </Modal>
    </div>
  );
}
