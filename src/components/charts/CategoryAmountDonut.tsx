"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { ChartCard } from "./ChartCard";

export type CategoryAmountPoint = { category: string; amount: number };

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function CategoryAmountTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: CategoryAmountPoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-[var(--foreground)]">{point.category}</p>
      <p className="text-[var(--muted)]">{formatCurrency(point.amount)}</p>
    </div>
  );
}

export function CategoryAmountDonut({
  title,
  subtitle,
  data,
  loading,
  colors,
  emptyMessage = "No data yet.",
}: {
  title: string;
  subtitle?: string;
  data: CategoryAmountPoint[];
  loading: boolean;
  colors: string[];
  emptyMessage?: string;
}) {
  const empty = data.length === 0 || data.every((point) => point.amount === 0);

  return (
    <ChartCard title={title} subtitle={subtitle} loading={loading} empty={empty} emptyMessage={emptyMessage}>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} dataKey="amount" nameKey="category" innerRadius={64} outerRadius={92} paddingAngle={2} strokeWidth={0}>
            {data.map((point, index) => (
              <Cell key={point.category} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<CategoryAmountTooltip />} />
          <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 12, color: "#334155" }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
