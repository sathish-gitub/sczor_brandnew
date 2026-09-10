"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartCard } from "./ChartCard";

export type CustomerGrowthPoint = { date: string; newCustomers: number; returningCustomers: number };

function formatDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(date);
}

function CustomerGrowthTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-[var(--foreground)]">{formatDateLabel(label)}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {entry.dataKey === "newCustomers" ? "New" : "Returning"}: {entry.value}
        </p>
      ))}
    </div>
  );
}

export function CustomerGrowthChart({ data, loading }: { data: CustomerGrowthPoint[]; loading: boolean }) {
  const empty = data.length === 0 || data.every((point) => point.newCustomers === 0 && point.returningCustomers === 0);

  return (
    <ChartCard
      title="Customer Growth"
      subtitle="New vs. returning customers"
      loading={loading}
      empty={empty}
      emptyMessage="No customer activity in this period."
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
          <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
          <Tooltip content={<CustomerGrowthTooltip />} />
          <Legend
            formatter={(value) => (value === "newCustomers" ? "New" : "Returning")}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Line type="monotone" dataKey="newCustomers" stroke="#22C55E" strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="returningCustomers" stroke="#7C3AED" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
