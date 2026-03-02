"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { CheckCircle2, CircleOff, Eye, FileText, Handshake, MessageSquare, Plane, Send, Sparkles, Upload, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { JobStatus } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";

const statusOptions: JobStatus[] = ["applied", "proposal", "interview", "offer", "rejected", "no_answer"];
const statusTone: Record<JobStatus, string> = {
  applied: "bg-emerald-100 text-emerald-700 border-emerald-200",
  proposal: "bg-blue-100 text-blue-700 border-blue-200",
  interview: "bg-amber-100 text-amber-700 border-amber-200",
  offer: "bg-violet-100 text-violet-700 border-violet-200",
  rejected: "bg-rose-100 text-rose-700 border-rose-200",
  no_answer: "bg-slate-100 text-slate-600 border-slate-200"
};
const statusMeta: Record<JobStatus, { label: string; Icon: LucideIcon }> = {
  applied: { label: "Applied", Icon: Send },
  proposal: { label: "Proposal", Icon: FileText },
  interview: { label: "Interview", Icon: MessageSquare },
  offer: { label: "Offer", Icon: Handshake },
  rejected: { label: "Rejected", Icon: CircleOff },
  no_answer: { label: "No answer", Icon: Plane }
};
const cvStorageKey = "myhire-cv-versions";
const COVER_LETTER_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_COVER_LETTER_TYPES = new Set(["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"]);
const ALLOWED_COVER_LETTER_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt"];

const isAllowedCoverLetter = (file: File) => ALLOWED_COVER_LETTER_TYPES.has(file.type) || ALLOWED_COVER_LETTER_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
const getMatchScore = (row: any) => {
  const parsed = Number(row.ai_insights_json?.match_score ?? row.match_score ?? Number.NaN);
  return Number.isNaN(parsed) ? null : Math.max(0, Math.min(100, Math.round(parsed)));
};
const getScoreTone = (score: number | null) => (score == null ? "bg-slate-100 text-slate-700" : score >= 80 ? "bg-emerald-100 text-emerald-700" : score >= 60 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700");
const countryIcon = (country?: string | null, mode?: string | null) => (mode === "remote" ? "✈️" : country ? country.slice(0, 2).toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0))) : "-");

type CvVersion = { id: string; name: string; summary: string; skills: string; filePath?: string; isDefault?: boolean; createdAt: string };

function StatusIconSelect({ status, onChange }: { status: JobStatus; onChange: (status: JobStatus) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const currentMeta = statusMeta[status];
  const CurrentIcon = currentMeta.Icon;

  return <div ref={rootRef} className="relative inline-block text-left">
    <Button type="button" variant="ghost" className={`h-9 w-9 rounded-full border p-0 ${statusTone[status] ?? ""}`} title={`Status: ${currentMeta.label}`} onClick={() => setOpen((prev) => !prev)}>
      <CurrentIcon size={16} />
    </Button>
    {open ? <div className="absolute left-0 z-20 mt-2 w-40 rounded-lg border border-border bg-white p-1 shadow-lg">
      {statusOptions.map((option) => {
        const optionMeta = statusMeta[option];
        const OptionIcon = optionMeta.Icon;
        return <button key={option} type="button" className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-slate-100 ${option === status ? "bg-slate-100 font-medium" : ""}`} onClick={() => { onChange(option); setOpen(false); }}>
          <OptionIcon size={14} className="text-slate-600" />
          <span>{optionMeta.label}</span>
        </button>;
      })}
    </div> : null}
  </div>;
}

export function JobsTable({ initialData, userId }: { initialData: any[]; userId: string }) {
  const supabase = createClient();
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

  const updateStatus = async (id: string, status: JobStatus) => {
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

  const runImport = async (bypassDuplicateCheck = false) => {
    const selectedCv = cvVersions.find((item) => item.id === selectedCvId);
    const res = await fetch("/api/import", {
      method: "POST",
      body: JSON.stringify({ url: sourceUrl, content: entryMode === "manual" ? pageContent : "", cvText: selectedCv ? `${selectedCv.summary}\n${selectedCv.skills}` : "", cvFilePath: selectedCv?.filePath ?? null, cvVersionName: selectedCv?.name ?? null, bypassDuplicateCheck })
    });
  }, [data, filterTitle, filterCompany, filterStatus]);

  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        accessorKey: "job_title",
        header: "Job Title",
        cell: ({ row }) => (
          <Link
            href={`/jobs/${row.original.id}`}
            className="font-medium text-indigo-700 hover:underline"
          >
            {row.original.job_title}
          </Link>
        ),
      },
      { accessorKey: "company_name", header: "Company" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Select
            value={row.original.status}
            onChange={(e) => updateStatus(row.original.id, e.target.value as JobStatus)}
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        ),
      },
      {
        accessorKey: "job_url",
        header: "URL",
        cell: ({ row }) =>
          row.original.job_url ? (
            <a
              href={row.original.job_url}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 underline"
            >
              Open
            </a>
          ) : (
            "-"
          ),
      },
    ],
    [data]
  );

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap">
        <Input
          placeholder="Job title"
          value={filterTitle}
          onChange={(e) => setFilterTitle(e.target.value)}
          className="w-full sm:w-44"
        />
        <Input
          placeholder="Company"
          value={filterCompany}
          onChange={(e) => setFilterCompany(e.target.value)}
          className="w-full sm:w-44"
        />
        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-full sm:w-44"
        >
          <option value="">All status</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Button onClick={refresh}>Refresh</Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
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
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="border-t px-3 py-2">
                    {cell.column.columnDef.cell
                      ? flexRender(cell.column.columnDef.cell, cell.getContext())
                      : String(cell.getValue() ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">User: {userId}</p>
    </div>
  );
}
