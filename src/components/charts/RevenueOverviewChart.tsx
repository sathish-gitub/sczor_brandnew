"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartCard } from "./ChartCard";

export type RevenueOverviewPoint = { month: string; revenue: number };

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function RevenueTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length || !label) return null;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-[var(--foreground)]">{label}</p>
      <p className="text-[var(--muted)]">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

export function RevenueOverviewChart({ data, loading }: { data: RevenueOverviewPoint[]; loading: boolean }) {
  const empty = data.length === 0 || data.every((point) => point.revenue === 0);

  return (
    <ChartCard
      title="Revenue Overview"
      subtitle="Monthly subscription revenue"
      loading={loading}
      empty={empty}
      emptyMessage="No successful payments in this period."
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2F7" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(value) => `₹${Number(value).toLocaleString("en-IN")}`}
            tick={{ fontSize: 11, fill: "#64748B" }}
            axisLine={false}
            tickLine={false}
            width={72}
          />
          <Tooltip content={<RevenueTooltip />} cursor={{ fill: "rgba(148, 163, 184, 0.1)" }} />
          <Bar dataKey="revenue" fill="#1E40AF" radius={[6, 6, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
