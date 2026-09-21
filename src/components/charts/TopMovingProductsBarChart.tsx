"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartCard } from "./ChartCard";

export type TopMovingProductPoint = { name: string; unitsSold: number; revenue: number };

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function TopMoversTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TopMovingProductPoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-[var(--foreground)]">{point.name}</p>
      <p className="text-[var(--muted)]">{point.unitsSold} units sold</p>
      <p className="text-[var(--muted)]">{formatCurrency(point.revenue)}</p>
    </div>
  );
}

export function TopMovingProductsBarChart({ data, loading }: { data: TopMovingProductPoint[]; loading: boolean }) {
  const empty = data.length === 0 || data.every((point) => point.unitsSold === 0);

  return (
    <ChartCard
      title="Top Moving Products"
      subtitle="Units sold in this period"
      loading={loading}
      empty={empty}
      emptyMessage="No product sales in this period."
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EEF2F7" />
          <XAxis type="number" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12, fill: "#334155" }}
            axisLine={false}
            tickLine={false}
            width={110}
          />
          <Tooltip content={<TopMoversTooltip />} cursor={{ fill: "rgba(148, 163, 184, 0.1)" }} />
          <Bar dataKey="unitsSold" fill="#0D9488" radius={[0, 6, 6, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
