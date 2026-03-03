"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { CheckCircle2, CircleOff, Eye, ExternalLink, FileText, Handshake, MessageSquare, Plane, Send, Sparkles, Trash2, Upload, X, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { JobStatus } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast-provider";
import Link from "next/link";

const statusOptions: JobStatus[] = ["applied", "proposal", "interview", "offer", "rejected", "no_answer"];
const statusTone: Record<JobStatus, string> = { applied: "bg-emerald-100 text-emerald-700 border-emerald-200", proposal: "bg-blue-100 text-blue-700 border-blue-200", interview: "bg-amber-100 text-amber-700 border-amber-200", offer: "bg-violet-100 text-violet-700 border-violet-200", rejected: "bg-rose-100 text-rose-700 border-rose-200", no_answer: "bg-slate-100 text-slate-600 border-slate-200" };
const statusMeta: Record<JobStatus, { label: string; Icon: LucideIcon }> = { applied: { label: "Applied", Icon: Send }, proposal: { label: "Proposal", Icon: FileText }, interview: { label: "Interview", Icon: MessageSquare }, offer: { label: "Offer", Icon: Handshake }, rejected: { label: "Rejected", Icon: CircleOff }, no_answer: { label: "No answer", Icon: Plane } };
const cvStorageKey = "myhire-cv-versions";
const COVER_LETTER_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_COVER_LETTER_TYPES = new Set(["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"]);
const ALLOWED_COVER_LETTER_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt"];
const isAllowedCoverLetter = (file: File) => ALLOWED_COVER_LETTER_TYPES.has(file.type) || ALLOWED_COVER_LETTER_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
const getMatchScore = (row: any) => { const parsed = Number(row.ai_insights_json?.match_score ?? row.match_score ?? Number.NaN); return Number.isNaN(parsed) ? null : Math.max(0, Math.min(100, Math.round(parsed))); };
const getScoreTone = (score: number | null) => score == null ? "bg-slate-100 text-slate-700" : score >= 80 ? "bg-emerald-100 text-emerald-700 shimmer" : score >= 60 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
const countryIcon = (country?: string | null, mode?: string | null) => ((mode || "").toLowerCase().includes("remote") ? "✈️" : country ? country.slice(0, 2).toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0))) : "-");

type CvVersion = { id: string; name: string; summary: string; skills: string; filePath?: string; isDefault?: boolean; createdAt: string };

function StatusIconSelect({ status, onChange }: { status: JobStatus; onChange: (status: JobStatus) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (!open) return; const onClick = (event: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false); }; document.addEventListener("mousedown", onClick); return () => document.removeEventListener("mousedown", onClick); }, [open]);
  const currentMeta = statusMeta[status]; const CurrentIcon = currentMeta.Icon;
  return <div ref={rootRef} className="relative inline-block text-left"><Button type="button" variant="ghost" className={`h-9 w-9 rounded-full border p-0 ${statusTone[status] ?? ""}`} title={`Status: ${currentMeta.label}`} onClick={() => setOpen((prev) => !prev)}><CurrentIcon size={16} /></Button>{open ? <div className="absolute left-0 z-20 mt-2 w-40 rounded-lg border border-border bg-white p-1 shadow-lg">{statusOptions.map((option) => { const optionMeta = statusMeta[option]; const OptionIcon = optionMeta.Icon; return <button key={option} type="button" className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-slate-100 ${option === status ? "bg-slate-100 font-medium" : ""}`} onClick={() => { onChange(option); setOpen(false); }}><OptionIcon size={14} className="text-slate-600" /><span>{optionMeta.label}</span></button>; })}</div> : null}</div>;
}

export function JobsTable({ initialData, userId }: { initialData: any[]; userId: string }) {
  const supabase = createClient();
  const { pushToast } = useToast();
  const [data, setData] = useState<any[]>(initialData);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState({ title: "", company: "", status: "" });
  const [sortBy, setSortBy] = useState<"applied_at" | "job_title" | "company_name">("applied_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [open, setOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<"url" | "manual">("url");
  const [sourceUrl, setSourceUrl] = useState("");
  const [pageContent, setPageContent] = useState("");
  const [selectedCvId, setSelectedCvId] = useState("");
  const [cvVersions, setCvVersions] = useState<CvVersion[]>([]);
  const [pending, startTransition] = useTransition();
  const [duplicateWarn, setDuplicateWarn] = useState<any>(null);
  const [previewScore, setPreviewScore] = useState<number | null>(null);
  const [processingState, setProcessingState] = useState<"idle" | "processing" | "done">("idle");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);

  useEffect(() => { const stored = localStorage.getItem(cvStorageKey); if (!stored) return; const parsed = JSON.parse(stored) as CvVersion[]; setCvVersions(parsed); const defaultCv = parsed.find((item) => item.isDefault) ?? parsed[0]; if (defaultCv) setSelectedCvId(defaultCv.id); }, []);
  const refresh = async () => { const { data: rows } = await supabase.from("v_job_applications_enriched").select("*").order("applied_at", { ascending: false }); setData(rows ?? []); setSelectedIds([]); };
  const updateStatus = async (id: string, status: JobStatus) => { await supabase.from("job_applications").update({ status, status_updated_at: new Date().toISOString() }).eq("id", id); pushToast("Status updated"); refresh(); };
  const deleteSelected = async () => { if (!selectedIds.length) return; const { error } = await supabase.from("job_applications").delete().in("id", selectedIds); if (error) return pushToast(error.message, "error"); setData((prev) => prev.filter((row) => !selectedIds.includes(row.id))); setSelectedIds([]); pushToast("Applications deleted"); setConfirmDeleteOpen(false); };

  const runImport = async (bypassDuplicateCheck = false) => {
    const selectedCv = cvVersions.find((item) => item.id === selectedCvId);
    const res = await fetch("/api/import", { method: "POST", body: JSON.stringify({ url: sourceUrl, content: entryMode === "manual" ? pageContent : "", cvText: selectedCv ? `${selectedCv.summary}\n${selectedCv.skills}` : "", cvFilePath: selectedCv?.filePath ?? null, cvVersionName: selectedCv?.name ?? null, bypassDuplicateCheck }) });
    return { res, payload: await res.json(), selectedCv };
  };
  const previewImport = async () => { const selectedCv = cvVersions.find((item) => item.id === selectedCvId); const res = await fetch("/api/import", { method: "POST", body: JSON.stringify({ url: sourceUrl, content: entryMode === "manual" ? pageContent : "", cvText: selectedCv ? `${selectedCv.summary}\n${selectedCv.skills}` : "", previewOnly: true }) }); const payload = await res.json(); if (!res.ok) return pushToast(payload.error || "Preview failed", "error"); setPreviewScore(payload.preview?.matchScore ?? null); if (payload.preview?.duplicate) setDuplicateWarn(payload.preview); };
  const importText = async (bypassDuplicateCheck = false) => { if (!sourceUrl.trim()) return pushToast("Job URL is mandatory", "error"); setProcessingState("processing"); const { res, payload, selectedCv } = await runImport(bypassDuplicateCheck); if (!res.ok) { setProcessingState("idle"); if (res.status === 409) return setDuplicateWarn(payload); return pushToast(payload.error || "AI import failed", "error"); } if (selectedCv) { const { data: jobRow } = await supabase.from("job_applications").select("ai_insights_json").eq("id", payload.jobId).maybeSingle(); await supabase.from("job_applications").update({ ai_insights_json: { ...(jobRow?.ai_insights_json ?? {}), cv_version_id: selectedCv.id, cv_version_name: selectedCv.name } }).eq("id", payload.jobId); }
    setProcessingState("done"); pushToast("Application created"); setTimeout(() => { setOpen(false); setProcessingState("idle"); setSourceUrl(""); setPageContent(""); setPreviewScore(null); setDuplicateWarn(null); refresh(); }, 700);
  };
  const uploadCoverLetter = async (jobId: string, file: File) => { if (file.size > COVER_LETTER_MAX_BYTES) return pushToast("Cover letter must be 5MB or smaller.", "error"); if (!isAllowedCoverLetter(file)) return pushToast("Allowed types: PDF, DOC, DOCX, TXT", "error"); const path = `${userId}/cover-letter/${jobId}/${Date.now()}-${file.name}`; const { error } = await supabase.storage.from("job-files").upload(path, file, { upsert: true }); if (error) return pushToast(error.message, "error"); await supabase.from("job_applications").update({ cover_letter_file_path: path }).eq("id", jobId); pushToast("Cover letter uploaded"); refresh(); };
  const downloadFile = async (path: string) => { const { data: signed, error } = await supabase.storage.from("job-files").createSignedUrl(path, 120); if (error || !signed?.signedUrl) return pushToast(error?.message ?? "Download failed", "error"); window.open(signed.signedUrl, "_blank"); };

  const filteredData = useMemo(() => { const rows = data.filter((row) => row.job_title?.toLowerCase().includes(filter.title.toLowerCase()) && row.company_name?.toLowerCase().includes(filter.company.toLowerCase()) && (!filter.status || row.status === filter.status)); return rows.sort((a, b) => { const left = a[sortBy] ?? ""; const right = b[sortBy] ?? ""; if (sortBy === "applied_at") return sortDir === "desc" ? new Date(right).getTime() - new Date(left).getTime() : new Date(left).getTime() - new Date(right).getTime(); return sortDir === "desc" ? String(right).localeCompare(String(left)) : String(left).localeCompare(String(right)); }); }, [data, filter, sortBy, sortDir]);

  const columns = useMemo<ColumnDef<any>[]>(() => [
    { id: "select", header: () => <span className="sr-only">Select</span>, cell: ({ row }) => <input type="checkbox" checked={selectedIds.includes(row.original.id)} onChange={(e) => (e.target.checked ? setSelectedIds((prev) => [...new Set([...prev, row.original.id])]) : setSelectedIds((prev) => prev.filter((id) => id !== row.original.id)))} /> },
    { accessorKey: "job_title", header: "Job Title", cell: ({ row }) => <Link href={`/jobs/${row.original.id}`} className="line-clamp-1 font-medium text-indigo-700 hover:underline">{row.original.job_title}</Link> },
    { accessorKey: "company_name", header: "Company" },
    { id: "salary", header: "Salary range", cell: ({ row }) => row.original.salary_text || (row.original.salary_min || row.original.salary_max ? `${row.original.salary_min ?? "-"} - ${row.original.salary_max ?? "-"} ${row.original.salary_currency ?? ""}` : "-") },
    { id: "country", header: "Country", cell: ({ row }) => <span title={row.original.country || "Remote"} className="text-lg">{(row.original.work_mode || "").toLowerCase().includes("remote") ? <Plane size={16} className="inline" /> : countryIcon(row.original.country, row.original.work_mode)}</span> },
    { id: "match_score", header: "AI Match", cell: ({ row }) => { const score = getMatchScore(row.original); return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getScoreTone(score)}`}>{score == null ? "Not scored" : `${score}%`}</span>; } },
    { id: "cv_version", header: "CV Version", cell: ({ row }) => row.original.ai_insights_json?.cv_version_name || "Default CV" },
    { accessorKey: "job_url", header: "Job URL", cell: ({ row }) => (row.original.job_url ? <a href={row.original.job_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 underline">Open <ExternalLink size={12} /></a> : "-") },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusIconSelect status={row.original.status as JobStatus} onChange={(status) => updateStatus(row.original.id, status)} /> },
    { accessorKey: "days_since_applied", header: "Days Since Applied", cell: ({ row }) => <span className={row.original.is_overdue ? "font-semibold text-red-600" : ""}>{row.original.days_since_applied ?? "-"}</span> },
    { accessorKey: "files", header: "Cover Letter", cell: ({ row }) => <div className="flex items-center gap-2"><label className="cursor-pointer rounded-lg border border-border bg-slate-50 p-2 text-slate-700 transition hover:bg-slate-100" title="Upload cover letter"><Upload size={15} /><input type="file" accept="application/pdf,.pdf,application/msword,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,text/plain,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && uploadCoverLetter(row.original.id, e.target.files[0])} /></label><Button variant="ghost" className="h-8 w-8 p-0" disabled={!row.original.cover_letter_file_path} onClick={() => downloadFile(row.original.cover_letter_file_path)}>{row.original.cover_letter_file_path ? <Eye size={16} className="text-indigo-600" /> : <FileText size={16} className="text-slate-400" />}</Button></div> }
  ], [selectedIds]);

  const table = useReactTable({ data: filteredData, columns, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel() });

  return <div className="space-y-4">
    <div className="card relative overflow-hidden border-indigo-100"><div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-cyan-400/5 to-fuchsia-500/10" /><div className="relative flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-slate-500">AI Hiring Assistant</p><h3 className="text-lg font-semibold">Smart matching + CV version control</h3></div><Button className="group" onClick={() => setOpen(true)}><Sparkles size={15} className="transition group-hover:rotate-12" />Add Application</Button></div></div>
    <div className="flex items-center justify-between"><Button variant="ghost" onClick={() => setFiltersOpen((v) => !v)}>{filtersOpen ? "Hide" : "Show"} filters</Button><Button variant="danger" disabled={!selectedIds.length} onClick={() => setConfirmDeleteOpen(true)}><Trash2 size={14} />Delete Selected ({selectedIds.length})</Button></div>
    {filtersOpen ? <div className="grid gap-2 rounded-xl border border-border/70 bg-panel/70 p-2 sm:grid-cols-5"><Input placeholder="Job title" value={filter.title} onChange={(e) => setFilter({ ...filter, title: e.target.value })} /><Input placeholder="Company" value={filter.company} onChange={(e) => setFilter({ ...filter, company: e.target.value })} /><Select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}><option value="">All status</option>{statusOptions.map((s) => <option key={s}>{s}</option>)}</Select><Select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}><option value="applied_at">Applied date</option><option value="job_title">Job title</option><option value="company_name">Company</option></Select><Select value={sortDir} onChange={(e) => setSortDir(e.target.value as any)}><option value="desc">Descending</option><option value="asc">Ascending</option></Select></div> : null}

    {selectedIds.length ? <div className="sticky top-14 z-10 flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm"><span>{selectedIds.length} selected</span><Button variant="ghost" onClick={() => setSelectedIds([])}><X size={14} />Clear</Button></div> : null}

    {table.getRowModel().rows.length === 0 ? <EmptyState title="No jobs found" description="Try clearing filters or add a new application." /> : <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-sm"><table className="w-full text-sm"><thead className="sticky top-0 bg-muted/95 backdrop-blur">{table.getHeaderGroups().map((hg) => <tr key={hg.id}>{hg.headers.map((h) => <th key={h.id} className="px-3 py-2 text-left">{flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map((row, idx) => <tr key={row.id} className={`transition hover:-translate-y-[1px] hover:bg-indigo-50/40 ${idx % 2 ? "bg-slate-50/40" : ""} ${row.original.is_overdue ? "bg-red-50" : ""}`}>{row.getVisibleCells().map((cell) => <td key={cell.id} className="border-t border-border px-3 py-2 align-top">{cell.column.columnDef.cell ? flexRender(cell.column.columnDef.cell, cell.getContext()) : String(cell.getValue() ?? "")}</td>)}</tr>)}</tbody></table></div>}

    <Modal open={open} onClose={() => setOpen(false)} title="Add New Application"><div className="space-y-4"><div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm"><button onClick={() => setEntryMode("url")} className={`rounded-md px-3 py-1 ${entryMode === "url" ? "bg-white shadow" : ""}`}>URL scraper</button><button onClick={() => setEntryMode("manual")} className={`rounded-md px-3 py-1 ${entryMode === "manual" ? "bg-white shadow" : ""}`}>Add manually</button></div><div className="grid gap-3"><Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="Job URL (required)" required />{entryMode === "manual" ? <Textarea value={pageContent} onChange={(e) => setPageContent(e.target.value)} className="min-h-44" placeholder="Paste content." /> : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">We will scrape the URL and auto-fill all job information using AI.</p>}<div><p className="mb-1 text-sm font-medium">CV version for this application</p><Select value={selectedCvId} onChange={(e) => setSelectedCvId(e.target.value)}><option value="">No CV profile selected</option>{cvVersions.map((cv) => <option key={cv.id} value={cv.id}>{cv.name}{cv.isDefault ? " (default)" : ""}</option>)}</Select></div>{previewScore != null ? <p className="rounded bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700">Profile match score: {previewScore}%</p> : null}<div className="flex flex-col gap-2 sm:flex-row"><Button variant="ghost" onClick={() => startTransition(previewImport)} disabled={!sourceUrl.trim() || pending}>Preview match / duplicates</Button><Button disabled={pending || !sourceUrl.trim() || (entryMode === "manual" && !pageContent.trim())} onClick={() => startTransition(() => importText(false))}>{pending || processingState === "processing" ? "Analyzing..." : "Analyze with AI & create"}</Button></div>{processingState === "processing" ? <p className="animate-pulse text-center text-sm text-indigo-600">✨ Processing your application...</p> : null}{processingState === "done" ? <p className="flex items-center justify-center gap-1 text-sm font-medium text-emerald-600"><CheckCircle2 size={16} /> Job added successfully!</p> : null}</div></div></Modal>
    <Modal open={Boolean(duplicateWarn)} onClose={() => setDuplicateWarn(null)} title="Possible duplicated job position"><p className="text-sm text-slate-700">You are adding a duplicated job position.</p>{duplicateWarn?.duplicateOlderThan3Weeks ? <p className="mt-2 text-sm text-amber-700">Last application was more than 3 weeks ago ({duplicateWarn?.duplicateAgeDays} days).</p> : null}<div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setDuplicateWarn(null)}>Cancel</Button><Button onClick={() => { setDuplicateWarn(null); startTransition(() => importText(true)); }}>Add anyway</Button></div></Modal>
    <Modal open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} title="Confirm delete"><p className="text-sm text-slate-700">Delete {selectedIds.length} selected applications?</p><div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setConfirmDeleteOpen(false)}>Cancel</Button><Button variant="danger" onClick={deleteSelected}>Delete selected</Button></div></Modal>
  </div>;
}
