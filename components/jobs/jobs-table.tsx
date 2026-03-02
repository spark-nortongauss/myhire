"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { JobStatus } from "@/types/db";
import { createClient } from "@/lib/supabase/client";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const statusOptions: JobStatus[] = [
  "applied",
  "proposal",
  "interview",
  "offer",
  "rejected",
  "no_answer",
];

export function JobsTable({
  initialData,
  userId,
}: {
  initialData: any[];
  userId: string;
}) {
  const supabase = createClient();
  const [data, setData] = useState<any[]>(initialData);
  const [filterTitle, setFilterTitle] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const refresh = async () => {
    if (!supabase) return alert("Supabase client not configured.");
    const { data: rows } = await supabase
      .from("v_job_applications_enriched")
      .select("*")
      .order("applied_at", { ascending: false });
    setData(rows ?? []);
  };

  const updateStatus = async (id: string, status: JobStatus) => {
    if (!supabase) return alert("Supabase client not configured.");
    await supabase
      .from("job_applications")
      .update({ status, status_updated_at: new Date().toISOString() })
      .eq("id", id);
    refresh();
  };

  const filtered = useMemo(() => {
    return data.filter((row) => {
      const okTitle = (row.job_title ?? "")
        .toLowerCase()
        .includes(filterTitle.toLowerCase());
      const okCompany = (row.company_name ?? "")
        .toLowerCase()
        .includes(filterCompany.toLowerCase());
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
