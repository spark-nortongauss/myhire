"use client";

import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ["#6d5efc", "#14b8a6", "#f59e0b", "#ef4444", "#3b82f6"];

export function FunnelChart({ data }: { data: Array<{ status: string; count: number }> }) {
  return (
    <div className="card h-72">
      <h3 className="mb-2 text-sm font-semibold">Pipeline Funnel</h3>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={data}>
          <XAxis dataKey="status" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#6d5efc" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WeeklyChart({ data }: { data: Array<{ week: string; count: number }> }) {
  return (
    <div className="card h-72">
      <h3 className="mb-2 text-sm font-semibold">Weekly Applications</h3>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={data}>
          <XAxis dataKey="week" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#14b8a6" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PlatformsChart({ data }: { data: Array<{ platform: string; count: number }> }) {
  return (
    <div className="card h-72">
      <h3 className="mb-2 text-sm font-semibold">Top Platforms</h3>
      <ResponsiveContainer width="100%" height="90%">
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="platform" outerRadius={90} label>
            {data.map((entry, idx) => (
              <Cell key={entry.platform} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
