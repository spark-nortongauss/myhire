"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { JobStatus } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";

const statusOptions: JobStatus[] = ["applied", "proposal", "interview", "offer", "rejected", "no_answer"];
const cvStorageKey = "myhire-cv-versions";

type CvVersion = {
  id: string;
  name: string;
  summary: string;
  skills: string;
  isDefault?: boolean;
  createdAt: string;
};

const today = new Date().toISOString().slice(0, 10);

const getMatchScore = (row: any) => {
  const raw = row.match_score ?? row.ai_insights_json?.match_score ?? null;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, Math.min(100, Math.round(parsed)));
};

const getScoreTone = (score: number | null) => {
  if (score == null) return "bg-slate-100 text-slate-700";
  if (score >= 80) return "bg-emerald-100 text-emerald-700";
  if (score >= 60) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
};

export function JobsTable({ initialData, userId }: { initialData: any[]; userId: string }) {
  const supabase = createClient();
  const [data, setData] = useState<any[]>(initialData);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState({ title: "", company: "", status: "", platform: "", work_mode: "" });
  const [open, setOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<"url" | "manual">("url");
  const [sourceUrl, setSourceUrl] = useState("");
  const [pageContent, setPageContent] = useState("");
  const [selectedCvId, setSelectedCvId] = useState("");
  const [cvVersions, setCvVersions] = useState<CvVersion[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const stored = localStorage.getItem(cvStorageKey);
    if (!stored) return;
    const parsed = JSON.parse(stored) as CvVersion[];
    setCvVersions(parsed);
    const defaultCv = parsed.find((item) => item.isDefault) ?? parsed[0];
    if (defaultCv) setSelectedCvId(defaultCv.id);
  }, []);

  const refresh = async () => {
    const { data: rows } = await supabase.from("v_job_applications_enriched").select("*").order("applied_at", { ascending: false });
    setData(rows ?? []);
    setSelectedIds([]);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("job_applications").update({ status, status_updated_at: new Date().toISOString() }).eq("id", id);
    refresh();
  };

  const deleteSelected = async () => {
    if (!selectedIds.length) return;
    const { error } = await supabase.from("job_applications").delete().in("id", selectedIds);
    if (error) return alert(error.message);
    setData((prev) => prev.filter((row) => !selectedIds.includes(row.id)));
    setSelectedIds([]);
  };

  const importText = async () => {
    const selectedCv = cvVersions.find((item) => item.id === selectedCvId);
    const res = await fetch("/api/import", {
      method: "POST",
      body: JSON.stringify({
        url: sourceUrl,
        content: entryMode === "manual" ? pageContent : "",
        cvText: selectedCv ? `${selectedCv.summary}\n${selectedCv.skills}` : ""
      })
    });

    const payload = await res.json();
    if (!res.ok || !payload?.jobId) return alert(payload.error || "AI import failed.");

    if (selectedCv) {
      const { data: jobRow } = await supabase.from("job_applications").select("ai_insights_json").eq("id", payload.jobId).maybeSingle();
      await supabase
        .from("job_applications")
        .update({
          ai_insights_json: {
            ...(jobRow?.ai_insights_json ?? {}),
            cv_version_id: selectedCv.id,
            cv_version_name: selectedCv.name
          }
        })
        .eq("id", payload.jobId);
    }

    setOpen(false);
    setSourceUrl("");
    setPageContent("");
    refresh();
  };

  const uploadCoverLetter = async (jobId: string, file: File) => {
    const path = `${userId}/cover-letter/${jobId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("job-files").upload(path, file, { upsert: true });
    if (error) return alert(error.message);
    await supabase.from("job_applications").update({ cover_letter_file_path: path }).eq("id", jobId);
    refresh();
  };

  const downloadFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("job-files").createSignedUrl(path, 120);
    if (error || !data?.signedUrl) return alert(error?.message ?? "Failed");
    window.open(data.signedUrl, "_blank");
  };

  const filteredData = useMemo(
    () =>
      data.filter((row) => {
        return (
          row.job_title?.toLowerCase().includes(filter.title.toLowerCase()) &&
          row.company_name?.toLowerCase().includes(filter.company.toLowerCase()) &&
          (!filter.status || row.status === filter.status) &&
          (!filter.platform || row.platform === filter.platform) &&
          (!filter.work_mode || row.work_mode === filter.work_mode)
        );
      }),
    [data, filter]
  );

  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        id: "select",
        header: () => <span className="sr-only">Select</span>,
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedIds.includes(row.original.id)}
            onChange={(e) => {
              if (e.target.checked) setSelectedIds((prev) => [...new Set([...prev, row.original.id])]);
              else setSelectedIds((prev) => prev.filter((id) => id !== row.original.id));
            }}
          />
        )
      },
      {
        accessorKey: "job_title",
        header: "Job Title",
        cell: ({ row }) => (
          <Link href={`/jobs/${row.original.id}`} className="font-medium text-indigo-700 hover:underline">
            {row.original.job_title}
          </Link>
        )
      },
      { accessorKey: "company_name", header: "Company" },
      {
        id: "match_score",
        header: "AI Match",
        cell: ({ row }) => {
          const score = getMatchScore(row.original);
          return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getScoreTone(score)}`}>{score == null ? "Not scored" : `${score}%`}</span>;
        }
      },
      {
        id: "cv_version",
        header: "CV Version",
        cell: ({ row }) => row.original.ai_insights_json?.cv_version_name || "Default CV"
      },
      {
        accessorKey: "job_url",
        header: "Job URL",
        cell: ({ row }) =>
          row.original.job_url ? (
            <a href={row.original.job_url} target="_blank" rel="noreferrer" className="text-indigo-600 underline">
              Open link
            </a>
          ) : (
            "-"
          )
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Select value={row.original.status} onChange={(e) => updateStatus(row.original.id, e.target.value)}>
            {statusOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        )
      },
      {
        accessorKey: "days_since_applied",
        header: "Days Since Applied",
        cell: ({ row }) => <span className={row.original.is_overdue ? "font-semibold text-red-600" : ""}>{row.original.days_since_applied ?? "-"}</span>
      },
      {
        accessorKey: "files",
        header: "Cover Letter",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <input type="file" className="w-28 text-xs" onChange={(e) => e.target.files?.[0] && uploadCoverLetter(row.original.id, e.target.files[0])} />
            {row.original.cover_letter_file_path ? (
              <Button variant="ghost" onClick={() => downloadFile(row.original.cover_letter_file_path)}>
                Open
              </Button>
            ) : null}
          </div>
        )
      }
    ],
    [selectedIds]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return (
    <div className="space-y-4">
      <div className="card relative overflow-hidden border-indigo-100">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-cyan-400/5 to-fuchsia-500/10" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">AI Hiring Assistant</p>
            <h3 className="text-lg font-semibold">Smart matching + CV version control</h3>
          </div>
          <Button className="group" onClick={() => setOpen(true)}>
            <Sparkles size={15} className="mr-2 transition group-hover:rotate-12" />
            Add New Application
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Job title" value={filter.title} onChange={(e) => setFilter({ ...filter, title: e.target.value })} className="w-40" />
        <Input placeholder="Company" value={filter.company} onChange={(e) => setFilter({ ...filter, company: e.target.value })} className="w-40" />
        <Select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} className="w-40">
          <option value="">All status</option>
          {statusOptions.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Button variant="danger" disabled={!selectedIds.length} onClick={deleteSelected}>
          Delete Selected ({selectedIds.length})
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-3 py-2 text-left">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className={`transition-colors hover:bg-indigo-50/40 ${row.original.is_overdue ? "bg-red-50" : ""}`}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="border-t border-border px-3 py-2 align-top">
                    {cell.column.columnDef.cell ? flexRender(cell.column.columnDef.cell, cell.getContext()) : String(cell.getValue() ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add New Application">
        <div className="space-y-4">
          <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm">
            <button onClick={() => setEntryMode("url")} className={`rounded-md px-3 py-1 ${entryMode === "url" ? "bg-white shadow" : ""}`}>
              URL scraper
            </button>
            <button onClick={() => setEntryMode("manual")} className={`rounded-md px-3 py-1 ${entryMode === "manual" ? "bg-white shadow" : ""}`}>
              Add manually
            </button>
          </div>

          <div className="grid gap-3">
            <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="Job URL" />
            {entryMode === "manual" ? (
              <Textarea
                value={pageContent}
                onChange={(e) => setPageContent(e.target.value)}
                className="min-h-44"
                placeholder="Paste the full job post content. AI will extract title, company, location and description."
              />
            ) : (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">We will scrape the URL and auto-fill all job information using AI.</p>
            )}
            <div>
              <p className="mb-1 text-sm font-medium">CV version for this application</p>
              <Select value={selectedCvId} onChange={(e) => setSelectedCvId(e.target.value)}>
                <option value="">No CV profile selected</option>
                {cvVersions.map((cv) => (
                  <option key={cv.id} value={cv.id}>
                    {cv.name}
                    {cv.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </Select>
            </div>
            <Button disabled={pending || (!sourceUrl.trim() && !pageContent.trim())} onClick={() => startTransition(importText)}>
              {pending ? "Analyzing..." : "Analyze with AI & create application"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
