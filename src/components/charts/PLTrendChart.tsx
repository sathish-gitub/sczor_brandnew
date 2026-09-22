"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartCard } from "./ChartCard";

export type PLTrendPoint = { month: string; revenue: number; expenses: number; netProfit: number };

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function PLTrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-[var(--foreground)]">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function PLTrendChart({ data, loading }: { data: PLTrendPoint[]; loading: boolean }) {
  const empty = data.length === 0 || data.every((point) => point.revenue === 0 && point.expenses === 0);

  return (
    <ChartCard
      title="Revenue vs Expenses vs Net Profit"
      subtitle="Last 6 months"
      loading={loading}
      empty={empty}
      emptyMessage="No financial data in the last 6 months."
    >
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2F7" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} width={56} />
          <Tooltip content={<PLTrendTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#334155" }} />
          <Bar dataKey="revenue" name="Revenue" fill="#22C55E" radius={[4, 4, 0, 0]} barSize={18} />
          <Bar dataKey="expenses" name="Expenses" fill="#DC2626" radius={[4, 4, 0, 0]} barSize={18} />
          <Line type="monotone" dataKey="netProfit" name="Net Profit" stroke="#1E40AF" strokeWidth={2.5} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
