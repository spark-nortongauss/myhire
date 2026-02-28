"use client";

import { useMemo, useState, useTransition } from "react";
import { ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { createClient } from "@/lib/supabase/client";
import type { JobApplication, JobStatus } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";

const statusOptions: JobStatus[] = ["applied", "proposal", "interview", "offer", "rejected", "no_answer"];

const today = new Date().toISOString().slice(0, 10);

export function JobsTable({ initialData, userId }: { initialData: any[]; userId: string }) {
  const supabase = createClient();
  const [data, setData] = useState<any[]>(initialData);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState({ title: "", company: "", status: "", platform: "", work_mode: "" });
  const [open, setOpen] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [pageContent, setPageContent] = useState("");
  const [pending, startTransition] = useTransition();
  const [manual, setManual] = useState<Partial<JobApplication>>({ status: "applied", applied_at: today });

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

  const createManual = async () => {
    await supabase.from("job_applications").insert({ ...manual, user_id: userId, applied_at: today });
    setOpen(false);
    setManual({ status: "applied", applied_at: today });
    refresh();
  };

  const importText = async () => {
    const res = await fetch("/api/import", { method: "POST", body: JSON.stringify({ url: sourceUrl, content: pageContent }) });
    if (!res.ok) alert("AI import failed. Please complete manual entry.");
    setOpen(false);
    setSourceUrl("");
    setPageContent("");
    refresh();
  };

  const uploadFile = async (jobId: string, kind: "cv" | "cover-letter", file: File) => {
    const path = `${userId}/${kind}/${jobId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("job-files").upload(path, file, { upsert: true });
    if (error) return alert(error.message);
    const updates = kind === "cv" ? { cv_file_path: path } : { cover_letter_file_path: path };
    await supabase.from("job_applications").update(updates).eq("id", jobId);
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
      { accessorKey: "platform", header: "Platform" },
      { accessorKey: "work_mode", header: "Work Mode" },
      {
        accessorKey: "days_since_applied",
        header: "Days Since Applied",
        cell: ({ row }) => <span className={row.original.is_overdue ? "font-semibold text-red-600" : ""}>{row.original.days_since_applied ?? "-"}</span>
      },
      {
        accessorKey: "files",
        header: "Files",
        cell: ({ row }) => (
          <div className="flex gap-1">
            <input type="file" className="w-24 text-xs" onChange={(e) => e.target.files?.[0] && uploadFile(row.original.id, "cv", e.target.files[0])} />
            <input type="file" className="w-28 text-xs" onChange={(e) => e.target.files?.[0] && uploadFile(row.original.id, "cover-letter", e.target.files[0])} />
            {row.original.cv_file_path ? (
              <Button variant="ghost" onClick={() => downloadFile(row.original.cv_file_path)}>
                CV
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
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Job title" value={filter.title} onChange={(e) => setFilter({ ...filter, title: e.target.value })} className="w-40" />
        <Input placeholder="Company" value={filter.company} onChange={(e) => setFilter({ ...filter, company: e.target.value })} className="w-40" />
        <Select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} className="w-40">
          <option value="">All status</option>
          {statusOptions.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Select value={filter.platform} onChange={(e) => setFilter({ ...filter, platform: e.target.value })} className="w-40">
          <option value="">All platform</option>
          <option>linkedin</option>
          <option>indeed</option>
          <option>wellfound</option>
          <option>company_site</option>
          <option>other</option>
        </Select>
        <Select value={filter.work_mode} onChange={(e) => setFilter({ ...filter, work_mode: e.target.value })} className="w-40">
          <option value="">All mode</option>
          <option>remote</option>
          <option>hybrid</option>
          <option>on_site</option>
        </Select>
        <Button onClick={() => setOpen(true)}>Add Job</Button>
        <Button variant="danger" disabled={!selectedIds.length} onClick={deleteSelected}>
          Delete Selected ({selectedIds.length})
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-white">
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
              <tr key={row.id} className={row.original.is_overdue ? "bg-red-50" : ""}>
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

      <Modal open={open} onClose={() => setOpen(false)} title="Add Job">
        <div className="space-y-3">
          <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="Job URL (optional)" />
          <Textarea value={pageContent} onChange={(e) => setPageContent(e.target.value)} className="min-h-40" placeholder="Paste full job webpage content here..." />
          <Button disabled={pending || !pageContent.trim()} onClick={() => startTransition(importText)}>
            Analyze with AI and Create Job
          </Button>
        </div>
        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-2 text-sm font-medium">Fallback manual entry</p>
          <div className="grid gap-2">
            <Input placeholder="Job title" onChange={(e) => setManual({ ...manual, job_title: e.target.value })} />
            <Input placeholder="Company" onChange={(e) => setManual({ ...manual, company_name: e.target.value })} />
            <Input placeholder="Job URL" onChange={(e) => setManual({ ...manual, job_url: e.target.value })} />
            <Input type="date" value={today} disabled />
            <Select onChange={(e) => setManual({ ...manual, status: e.target.value as JobStatus })}>
              {statusOptions.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Textarea placeholder="Brief description" onChange={(e) => setManual({ ...manual, brief_description: e.target.value })} />
            <Button onClick={createManual}>Create Job Manually</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
