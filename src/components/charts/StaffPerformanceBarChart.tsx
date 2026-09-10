"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartCard } from "./ChartCard";

export type StaffPerformancePoint = { name: string; revenue: number };

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function StaffTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: StaffPerformancePoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-[var(--foreground)]">{point.name}</p>
      <p className="text-[var(--muted)]">{formatCurrency(point.revenue)}</p>
    </div>
  );
}

export function StaffPerformanceBarChart({ data, loading }: { data: StaffPerformancePoint[]; loading: boolean }) {
  const empty = data.length === 0 || data.every((point) => point.revenue === 0);

  return (
    <ChartCard
      title="Staff Performance"
      subtitle="Revenue by staff member"
      loading={loading}
      empty={empty}
      emptyMessage="No staff-linked revenue in this period."
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EEF2F7" />
          <XAxis
            type="number"
            tickFormatter={(value) => `₹${value}`}
            tick={{ fontSize: 11, fill: "#64748B" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12, fill: "#334155" }}
            axisLine={false}
            tickLine={false}
            width={96}
          />
          <Tooltip content={<StaffTooltip />} cursor={{ fill: "rgba(148, 163, 184, 0.1)" }} />
          <Bar dataKey="revenue" fill="#0D9488" radius={[0, 6, 6, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
