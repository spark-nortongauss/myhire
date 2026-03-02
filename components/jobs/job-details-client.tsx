"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FileText, FileUser, Pencil, Plane, Save, WandSparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

const statusTone: Record<string, string> = { applied: "bg-blue-100 text-blue-700", proposal: "bg-violet-100 text-violet-700", interview: "bg-amber-100 text-amber-700", offer: "bg-emerald-100 text-emerald-700", rejected: "bg-rose-100 text-rose-700", no_answer: "bg-slate-200 text-slate-700" };
const getMatchScore = (data: any) => {
  const parsed = Number(data?.ai_insights_json?.match_score ?? data?.match_score ?? Number.NaN);
  return Number.isNaN(parsed) ? null : Math.max(0, Math.min(100, Math.round(parsed)));
};
const isRemoteMode = (mode?: string | null) => (mode || "").toLowerCase().includes("remote");
const flagFromCountry = (country?: string | null, mode?: string | null) => (isRemoteMode(mode) ? <Plane size={16} className="inline" /> : <span>{country ? country.slice(0, 2).toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0))) : "-"}</span>);

export function JobDetailsClient({ data }: { data: any }) {
  const supabase = createClient();
  const [row, setRow] = useState(data);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileTitle, setFileTitle] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(data.notes ?? "");
  const [draftNotes, setDraftNotes] = useState(data.notes ?? "");
  const [editingJob, setEditingJob] = useState(false);
  const [jobForm, setJobForm] = useState({ job_title: data.job_title ?? "", job_url: data.job_url ?? "", salary_text: data.salary_text ?? "", salary_min: data.salary_min ?? "", salary_max: data.salary_max ?? "", salary_currency: data.salary_currency ?? "" });
  const [coverLetter, setCoverLetter] = useState(data.ai_insights_json?.cover_letter_draft ?? "");
  const dirtyRef = useRef(false);

  const matchScore = getMatchScore(row);
  const cvPath = row.cv_file_path || row.ai_insights_json?.cv_file_path || null;
  const timeline = Array.isArray(row.ai_insights_json?.recruitment_timeline) ? row.ai_insights_json.recruitment_timeline : [];
  const currentStage = Number(row.ai_insights_json?.current_timeline_stage ?? 0);

  const summaryItems = useMemo(() => [
    { label: "Platform", value: row.platform || "Not specified" },
    { label: "Work mode", value: row.work_mode || "Not specified" },
    { label: "Industry", value: row.industry || "Not specified" },
    { label: "Country", value: isRemoteMode(row.work_mode) ? "Remote" : row.country || "Not specified" },
    { label: "Last update", value: row.status_updated_at ? new Date(row.status_updated_at).toLocaleDateString() : "Not updated yet" },
    { label: "Applied", value: row.applied_at ? new Date(row.applied_at).toLocaleDateString() : "Not set" }
  ], [row]);

  const openPreview = async (path: string, label: string) => {
    const { data: signed, error } = await supabase.storage.from("job-files").createSignedUrl(path, 120);
    if (error || !signed?.signedUrl) return alert(error?.message ?? "Failed to preview file");
    setFileUrl(signed.signedUrl);
    setFileTitle(label);
  };

  const saveNotes = async () => {
    const { error } = await supabase.from("job_applications").update({ notes: draftNotes }).eq("id", row.id);
    if (error) return alert(error.message);
    setNotes(draftNotes);
    setEditingNotes(false);
    dirtyRef.current = false;
  };

  const saveJobDetails = async () => {
    const payload = {
      job_title: jobForm.job_title,
      job_url: jobForm.job_url,
      salary_text: jobForm.salary_text || null,
      salary_min: jobForm.salary_min ? Number(jobForm.salary_min) : null,
      salary_max: jobForm.salary_max ? Number(jobForm.salary_max) : null,
      salary_currency: jobForm.salary_currency || null
    };
    const { error } = await supabase.from("job_applications").update(payload).eq("id", row.id);
    if (error) return alert(error.message);
    setRow((prev: any) => ({ ...prev, ...payload }));
    setEditingJob(false);
  };

  const updateTimelineStage = async (stage: number) => {
    const nextJson = { ...(row.ai_insights_json ?? {}), current_timeline_stage: stage };
    const { error } = await supabase.from("job_applications").update({ ai_insights_json: nextJson }).eq("id", row.id);
    if (error) return alert(error.message);
    setRow((prev: any) => ({ ...prev, ai_insights_json: nextJson }));
  };

  const generateCoverLetter = async () => {
    const localCv = localStorage.getItem("myhire-cv-versions");
    const cvVersions = localCv ? JSON.parse(localCv) : [];
    const cvId = row.ai_insights_json?.cv_version_id;
    const cv = cvVersions.find((item: any) => item.id === cvId) ?? cvVersions.find((item: any) => item.isDefault) ?? cvVersions[0];
    const cvText = cv ? `${cv.summary}\n${cv.skills}` : "";
    const res = await fetch("/api/cover-letter", { method: "POST", body: JSON.stringify({ jobId: row.id, cvText }) });
    const payload = await res.json();
    if (!res.ok) return alert(payload.error || "Generation failed");
    setCoverLetter(payload.letter);
  };

  return <div className="space-y-6">
    <div className="card overflow-hidden p-0"><div className="bg-grid relative border-b border-border px-6 py-8"><div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-sky-500/10 to-violet-500/10" /><div className="relative space-y-4"><Link href="/jobs" className="text-sm font-medium text-indigo-700 hover:underline">← Back to jobs</Link><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-muted-foreground">{row.company_name}</p><h1 className="text-3xl font-bold tracking-tight">{row.job_title}</h1><p className="mt-2 text-sm text-muted-foreground">Country: <span className="font-medium">{flagFromCountry(row.country, row.work_mode)} {isRemoteMode(row.work_mode) ? "Remote" : row.country || "Not specified"}</span></p></div><Badge className={statusTone[row.status] ?? "bg-muted"}>{row.status}</Badge></div><div className="flex flex-wrap gap-2"><Badge className={matchScore != null && matchScore >= 75 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>AI profile match: {matchScore == null ? "Not scored" : `${matchScore}%`}</Badge>{row.job_url ? <a href={row.job_url} target="_blank" rel="noreferrer" className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white">Open original listing</a> : null}<Button variant="ghost" className="rounded-full border bg-white/60" onClick={() => cvPath && openPreview(cvPath, "CV Preview")}><FileUser size={16} className={cvPath ? "text-emerald-600" : "text-slate-500"} /><span className="ml-2 text-xs">{row.ai_insights_json?.cv_version_name || (cvPath ? "CV uploaded" : "CV not uploaded")}</span></Button><Button variant="ghost" className="rounded-full border bg-white/60" onClick={() => row.cover_letter_file_path && openPreview(row.cover_letter_file_path, "Cover Letter Preview")}><FileText size={16} className={row.cover_letter_file_path ? "text-indigo-600" : "text-slate-500"} /><span className="ml-2 text-xs">{row.cover_letter_file_path ? "Cover letter uploaded" : "Cover letter not uploaded"}</span></Button></div></div></div></div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{summaryItems.map((item) => <div key={item.label} className="card"><p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p><p className="mt-2 text-sm font-medium">{item.value}</p></div>)}</div>

    <div className="card space-y-3"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Editable job details</h2><Button variant="ghost" onClick={() => setEditingJob((s) => !s)}><Pencil size={14} className="mr-1" />{editingJob ? "Cancel" : "Edit"}</Button></div>{editingJob ? <div className="grid gap-3 md:grid-cols-2"><Input value={jobForm.job_title} onChange={(e) => setJobForm({ ...jobForm, job_title: e.target.value })} placeholder="Job title" /><Input value={jobForm.job_url} onChange={(e) => setJobForm({ ...jobForm, job_url: e.target.value })} placeholder="URL" /><Input value={jobForm.salary_text} onChange={(e) => setJobForm({ ...jobForm, salary_text: e.target.value })} placeholder="Salary text" /><Input value={jobForm.salary_currency} onChange={(e) => setJobForm({ ...jobForm, salary_currency: e.target.value })} placeholder="Currency" /><Input value={jobForm.salary_min} onChange={(e) => setJobForm({ ...jobForm, salary_min: e.target.value })} placeholder="Min" /><Input value={jobForm.salary_max} onChange={(e) => setJobForm({ ...jobForm, salary_max: e.target.value })} placeholder="Max" /><div className="md:col-span-2"><Button onClick={saveJobDetails}><Save size={14} className="mr-1" />Save job details</Button></div></div> : <p className="text-sm text-slate-600">You can update title, URL and compensation snapshot values.</p>}</div>

    <div className="grid gap-4 xl:grid-cols-3"><div className="card xl:col-span-2"><h2 className="mb-3 text-lg font-semibold">Job description</h2><p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{row.job_description || row.brief_description || "No description added yet."}</p></div><div className="card"><h2 className="mb-3 text-lg font-semibold">Recruitment timeline</h2>{timeline.length ? <div className="space-y-2">{timeline.map((stage: string, index: number) => <button key={stage + index} onClick={() => updateTimelineStage(index)} className={`block w-full rounded border px-3 py-2 text-left text-sm ${index === currentStage ? "border-indigo-500 bg-indigo-50" : "border-slate-200"}`}>{index + 1}. {stage}</button>)}</div> : <p className="text-sm text-slate-600">No recruitment timeline was identified from the job description.</p>}</div></div>

    <div className="grid gap-4 xl:grid-cols-2"><div className="card space-y-3"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Cover Letter Generator</h2><Button onClick={generateCoverLetter}><WandSparkles size={14} className="mr-1" />Generate</Button></div><Textarea className="min-h-52" value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} placeholder="Generated cover letter appears here." /></div><div className="card space-y-3"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Private notes</h2>{!editingNotes ? <Button variant="ghost" onClick={() => setEditingNotes(true)}><Pencil size={14} className="mr-1" /> Edit</Button> : null}</div>{editingNotes ? <><Textarea className="min-h-36" value={draftNotes} onChange={(e) => { setDraftNotes(e.target.value); dirtyRef.current = e.target.value !== notes; }} /><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => { setEditingNotes(false); setDraftNotes(notes); }}>Cancel</Button><Button onClick={saveNotes}><Save size={14} className="mr-1" /> Save</Button></div></> : <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{notes || "No personal notes for this application yet."}</p>}</div></div>

    <Modal open={Boolean(fileUrl)} onClose={() => setFileUrl(null)} title={fileTitle}>{fileUrl ? <iframe src={fileUrl} className="h-[70vh] w-full rounded-md border" title={fileTitle} /> : null}</Modal>
  </div>;
}
