"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { JobStatus } from "@/types/db";
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

const statusOptions: JobStatus[] = ["applied", "proposal", "interview", "offer", "rejected", "no_answer"];

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
    if (!supabase) return alert("Supabase client not configured.");
    const { data: rows } = await supabase.from("v_job_applications_enriched").select("*").order("applied_at", { ascending: false });
    setData(rows ?? []);
    setSelectedIds([]);
  };

  const updateStatus = async (id: string, status: JobStatus) => {
    if (!supabase) return alert("Supabase client not configured.");
    await supabase.from("job_applications").update({ status, status_updated_at: new Date().toISOString() }).eq("id", id);
    refresh();
  };

  const filtered = useMemo(() => {
    return data.filter((row) => {
      const okTitle = (row.job_title ?? "").toLowerCase().includes(filterTitle.toLowerCase());
      const okCompany = (row.company_name ?? "").toLowerCase().includes(filterCompany.toLowerCase());
      const okStatus = !filterStatus || row.status === filterStatus;
      return okTitle && okCompany && okStatus;
    });
  }, [data, filterTitle, filterCompany, filterStatus]);

  const columns = useMemo<ColumnDef<any>[]>(
    () => [
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
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Select value={row.original.status} onChange={(e) => updateStatus(row.original.id, e.target.value as JobStatus)}>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        )
      },
      {
        accessorKey: "job_url",
        header: "URL",
        cell: ({ row }) =>
          row.original.job_url ? (
            <a href={row.original.job_url} target="_blank" rel="noreferrer" className="text-indigo-600 underline">
              Open
            </a>
          ) : (
            "-"
          )
      }
    ],
    [data]
  );

  const table = useReactTable({ data: filtered, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap">
        <Input placeholder="Job title" value={filterTitle} onChange={(e) => setFilterTitle(e.target.value)} className="w-full sm:w-44" />
        <Input placeholder="Company" value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} className="w-full sm:w-44" />
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full sm:w-44">
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
                    {cell.column.columnDef.cell ? flexRender(cell.column.columnDef.cell, cell.getContext()) : String(cell.getValue() ?? "")}
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
