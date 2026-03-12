"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { InterviewPrepListItem } from "@/types/interview-prep";
import { Button } from "@/components/ui/button";

export function InterviewPrepTable({ initialRows }: { initialRows: InterviewPrepListItem[] }) {
  const [rows, setRows] = useState<InterviewPrepListItem[]>(initialRows);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const rowIds = useMemo(() => rows.map((row) => row.id).filter(Boolean), [rows]);
  const allSelected = rowIds.length > 0 && selectedIds.length === rowIds.length;

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    setSelectedIds((prev) => (prev.length === rowIds.length ? [] : rowIds));
  };

  const deleteRows = async (ids: string[]) => {
    if (!ids.length || loading) return;
    const confirmed = window.confirm(`Delete ${ids.length} interview prep row(s)? This will also remove related mock interview sessions/messages.`);
    if (!confirmed) return;

    setLoading(true);
    const res = await fetch("/api/interview-prep/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      window.alert(payload.error || "Unable to delete selected rows.");
      setLoading(false);
      return;
    }

    const deleted = Array.isArray(payload.deletedIds) ? payload.deletedIds : [];
    setRows((prev) => prev.filter((row) => !deleted.includes(row.id)));
    setSelectedIds((prev) => prev.filter((id) => !deleted.includes(id)));

    if (Array.isArray(payload.failedIds) && payload.failedIds.length) {
      window.alert(`Some rows could not be deleted: ${payload.failedIds.join(", ")}`);
    }

    setLoading(false);
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <p className="text-sm text-muted-foreground">{selectedIds.length} selected</p>
        <Button variant="danger" disabled={!selectedIds.length || loading} onClick={() => deleteRows(selectedIds)}>Delete selected</Button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/90">
          <tr>
            <th className="px-3 py-2 text-left"><input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!rowIds.length || loading} /></th>
            <th className="px-3 py-2 text-left">Job title</th>
            <th className="px-3 py-2 text-left">Company name</th>
            <th className="px-3 py-2 text-left">Interviewers selected</th>
            <th className="px-3 py-2 text-left">Interview stage</th>
            <th className="px-3 py-2 text-left">Interview type</th>
            <th className="px-3 py-2 text-left">Prep status</th>
            <th className="px-3 py-2 text-left">Overall readiness score</th>
            <th className="px-3 py-2 text-left">Last session date</th>
            <th className="px-3 py-2 text-left">Updated at</th>
            <th className="px-3 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row) => (
            <tr key={row.id} className="border-t border-border hover:bg-slate-50">
              <td className="px-3 py-2"><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleRow(row.id)} disabled={loading} /></td>
              <td className="px-3 py-2 font-medium text-indigo-700 hover:underline"><Link href={`/interview-prep/${row.id}`}>{row.job_title || "Untitled job"}</Link></td>
              <td className="px-3 py-2">{row.company_name || "Unknown"}</td>
              <td className="px-3 py-2">{Array.isArray(row.selected_interviewers) && row.selected_interviewers.length ? row.selected_interviewers.slice(0, 3).join(", ") : "-"}</td>
              <td className="px-3 py-2">{row.interview_stage || "general"}</td>
              <td className="px-3 py-2">{row.interview_type || "general"}</td>
              <td className="px-3 py-2">{row.prep_status || "in_preparation"}</td>
              <td className="px-3 py-2">{Math.round(Number(row.overall_readiness_score ?? 0))}</td>
              <td className="px-3 py-2">{row.last_session_at ? new Date(row.last_session_at).toLocaleString() : "-"}</td>
              <td className="px-3 py-2">{row.updated_at ? new Date(row.updated_at).toLocaleString() : "-"}</td>
              <td className="px-3 py-2"><Button variant="ghost" disabled={loading} onClick={() => deleteRows([row.id])}>Delete</Button></td>
            </tr>
          )) : (
            <tr>
              <td className="px-3 py-6 text-center text-muted-foreground" colSpan={11}>No interview prep items yet. Move a job to interview status to create one.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
