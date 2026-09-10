"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { ChartCard } from "./ChartCard";

export type SalonStatusPoint = { status: string; count: number };

const STATUS_COLORS: Record<string, string> = {
  Active: "#22C55E",
  Trial: "#2563EB",
  Expired: "#F59E0B",
  Inactive: "#94A3B8",
};

function StatusTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: SalonStatusPoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-[var(--foreground)]">{point.status}</p>
      <p className="text-[var(--muted)]">{point.count} salons</p>
    </div>
  );
}

export function SalonStatusDonut({ data, loading }: { data: SalonStatusPoint[]; loading: boolean }) {
  const empty = data.length === 0 || data.every((point) => point.count === 0);

  return (
    <ChartCard
      title="Salon Status"
      subtitle="Active, trial, expired and inactive salons"
      loading={loading}
      empty={empty}
      emptyMessage="No salons yet."
    >
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="status" innerRadius={64} outerRadius={92} paddingAngle={2} strokeWidth={0}>
            {data.map((point) => (
              <Cell key={point.status} fill={STATUS_COLORS[point.status] ?? "#94A3B8"} />
            ))}
          </Pie>
          <Tooltip content={<StatusTooltip />} />
          <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 12, color: "#334155" }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
