"use client";

import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart } from "recharts";

const COLORS = ["#6d5efc", "#14b8a6", "#f59e0b", "#ef4444", "#3b82f6"];

const chartTooltip = { contentStyle: { borderRadius: 12, border: "1px solid #cbd5e1", boxShadow: "0 8px 24px -16px rgba(15,23,42,0.65)" } };

export function FunnelChart({ data }: { data: Array<{ status: string; count: number }> }) {
  return <div className="card h-72"><h3 className="mb-2 text-sm font-semibold">Pipeline Funnel</h3><ResponsiveContainer width="100%" height="90%"><BarChart data={data}><XAxis dataKey="status" /><YAxis allowDecimals={false} /><Tooltip {...chartTooltip} /><Bar dataKey="count" fill="#6d5efc" radius={[6, 6, 0, 0]} animationDuration={700} /></BarChart></ResponsiveContainer></div>;
}

export function TrendChart({ data, label }: { data: Array<{ period: string; count: number }>; label: string }) {
  return <div className="card h-72"><h3 className="mb-2 text-sm font-semibold">{label}</h3><ResponsiveContainer width="100%" height="90%"><BarChart data={data}><XAxis dataKey="period" /><YAxis allowDecimals={false} /><Tooltip {...chartTooltip} /><Bar dataKey="count" fill="#14b8a6" radius={[6, 6, 0, 0]} animationDuration={750} /></BarChart></ResponsiveContainer></div>;
}

export function WeeklyTrendMini({ data }: { data: Array<{ period: string; count: number }> }) {
  return <div className="h-16 w-28"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><Area type="monotone" dataKey="count" stroke="#6d5efc" fill="#c7d2fe" strokeWidth={2} animationDuration={650} /></AreaChart></ResponsiveContainer></div>;
}

export function PlatformsChart({ data }: { data: Array<{ platform: string; count: number }> }) {
  return <div className="card h-72"><h3 className="mb-2 text-sm font-semibold">Top Platforms</h3><ResponsiveContainer width="100%" height="90%"><PieChart><Pie data={data} dataKey="count" nameKey="platform" outerRadius={90} label animationDuration={700}>{data.map((entry, idx) => <Cell key={entry.platform} fill={COLORS[idx % COLORS.length]} />)}</Pie><Tooltip {...chartTooltip} /></PieChart></ResponsiveContainer></div>;
}
