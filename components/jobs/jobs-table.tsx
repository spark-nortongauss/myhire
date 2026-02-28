"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";
import { createClient } from "@/lib/supabase/client";
import type { JobApplication, JobStatus, Platform, WorkMode } from "@/types/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const statusOptions: JobStatus[] = ["applied", "proposal", "interview", "offer", "rejected", "no_answer"];

export function JobsTable({ initialData, userId }: { initialData: any[]; userId: string }) {
  const supabase = createClient();
  const [data, setData] = useState<any[]>(initialData);
  const [filter, setFilter] = useState({ title: "", company: "", status: "", platform: "", work_mode: "" });
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"url" | "manual">("url");
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const [manual, setManual] = useState<Partial<JobApplication>>({ status: "applied" });

  const refresh = async () => {
    const { data: rows } = await supabase.from("v_job_applications_enriched").select("*").order("applied_at", { ascending: false });
    setData(rows ?? []);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("job_applications").update({ status, status_updated_at: new Date().toISOString() }).eq("id", id);
    refresh();
  };

  const createManual = async () => {
    await supabase.from("job_applications").insert({ ...manual, user_id: userId });
    setOpen(false);
    setManual({ status: "applied" });
    refresh();
  };

  const importUrl = async () => {
    const res = await fetch("/api/import", { method: "POST", body: JSON.stringify({ url }) });
    if (!res.ok) alert("Import failed. Site may block scraping. Please add manually.");
    setOpen(false);
    setUrl("");
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
      { accessorKey: "job_title", header: "Job Title" },
      { accessorKey: "company_name", header: "Company" },
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
        cell: ({ row }) => (
          <span className={row.original.is_overdue ? "font-semibold text-red-600" : ""}>{row.original.days_since_applied ?? "-"}</span>
        )
      },
      {
        accessorKey: "files",
        header: "Files",
        cell: ({ row }) => (
          <div className="flex gap-1">
            <input type="file" className="w-24 text-xs" onChange={(e) => e.target.files?.[0] && uploadFile(row.original.id, "cv", e.target.files[0])} />
            <input
              type="file"
              className="w-28 text-xs"
              onChange={(e) => e.target.files?.[0] && uploadFile(row.original.id, "cover-letter", e.target.files[0])}
            />
            {row.original.cv_file_path ? (
              <Button variant="ghost" onClick={() => downloadFile(row.original.cv_file_path)}>
                CV
              </Button>
            ) : null}
          </div>
        )
      }
    ],
    []
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

      <Modal open={open} onClose={() => setOpen(false)} title="Add Job">
        <div className="mb-3 flex gap-2">
          <Button variant={tab === "url" ? "default" : "outline"} onClick={() => setTab("url")}>Paste URL</Button>
          <Button variant={tab === "manual" ? "default" : "outline"} onClick={() => setTab("manual")}>Manual Entry</Button>
        </div>
        {tab === "url" ? (
          <div className="space-y-3">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
            <Button disabled={pending} onClick={() => startTransition(importUrl)}>
              Import from URL
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            <Input placeholder="Job title" onChange={(e) => setManual({ ...manual, job_title: e.target.value })} />
            <Input placeholder="Company" onChange={(e) => setManual({ ...manual, company_name: e.target.value })} />
            <Input type="date" onChange={(e) => setManual({ ...manual, applied_at: e.target.value })} />
            <Select onChange={(e) => setManual({ ...manual, status: e.target.value as JobStatus })}>
              {statusOptions.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Textarea placeholder="Brief description" onChange={(e) => setManual({ ...manual, brief_description: e.target.value })} />
            <Button onClick={createManual}>Create Job</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
