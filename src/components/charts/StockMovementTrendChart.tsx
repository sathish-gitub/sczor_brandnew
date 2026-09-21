"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartCard } from "./ChartCard";

export type StockMovementTrendPoint = { date: string; stockIn: number; stockOut: number };

function formatDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(date);
}

function StockMovementTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;

  const stockIn = payload.find((item) => item.dataKey === "stockIn")?.value ?? 0;
  const stockOut = payload.find((item) => item.dataKey === "stockOut")?.value ?? 0;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-[var(--foreground)]">{formatDateLabel(label)}</p>
      <p className="text-emerald-600">Stock In: {stockIn}</p>
      <p className="text-red-600">Stock Out: {stockOut}</p>
    </div>
  );
}

export function StockMovementTrendChart({ data, loading }: { data: StockMovementTrendPoint[]; loading: boolean }) {
  const empty = data.length === 0 || data.every((point) => point.stockIn === 0 && point.stockOut === 0);

  return (
    <ChartCard
      title="Stock Movement Trend"
      subtitle="Daily stock in vs stock out"
      loading={loading}
      empty={empty}
      emptyMessage="No stock movements in this period."
    >
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2F7" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateLabel}
            tick={{ fontSize: 11, fill: "#64748B" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} width={40} />
          <Tooltip content={<StockMovementTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#334155" }} />
          <Line type="monotone" dataKey="stockIn" name="Stock In" stroke="#0D9488" strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="stockOut" name="Stock Out" stroke="#DC2626" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
