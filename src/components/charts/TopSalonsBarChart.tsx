"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartCard } from "./ChartCard";

export type TopSalonPoint = { name: string; revenue: number; appointments: number };

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function TopSalonTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TopSalonPoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-[var(--foreground)]">{point.name}</p>
      <p className="text-[var(--muted)]">{formatCurrency(point.revenue)}</p>
      <p className="text-[var(--muted)]">{point.appointments} appointments</p>
    </div>
  );
}

export function TopSalonsBarChart({ data, loading }: { data: TopSalonPoint[]; loading: boolean }) {
  const empty = data.length === 0 || data.every((point) => point.revenue === 0);

  return (
    <ChartCard
      title="Top Salons"
      subtitle="Ranked by paid invoice revenue"
      loading={loading}
      empty={empty}
      emptyMessage="No paid invoices recorded yet."
      height={Math.max(280, data.length * 40)}
    >
      <ResponsiveContainer width="100%" height={Math.max(280, data.length * 40)}>
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EEF2F7" />
          <XAxis
            type="number"
            tickFormatter={(value) => `₹${Number(value).toLocaleString("en-IN")}`}
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
            width={120}
          />
          <Tooltip content={<TopSalonTooltip />} cursor={{ fill: "rgba(148, 163, 184, 0.1)" }} />
          <Bar dataKey="revenue" radius={[0, 6, 6, 0]} maxBarSize={28}>
            {data.map((point) => (
              <Cell key={point.name} fill="#0D1B3E" className="transition-opacity hover:opacity-80" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
