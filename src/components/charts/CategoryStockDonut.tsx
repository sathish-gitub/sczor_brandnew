"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { ChartCard } from "./ChartCard";

export type CategoryStockPoint = { category: string; productCount: number; stockValue: number };

const CATEGORY_COLORS = ["#1E40AF", "#0D9488", "#D97706", "#0EA5E9", "#B45309", "#7C3AED", "#DC2626", "#64748B"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function CategoryTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: CategoryStockPoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-[var(--foreground)]">{point.category}</p>
      <p className="text-[var(--muted)]">{point.productCount} products</p>
      <p className="text-[var(--muted)]">{formatCurrency(point.stockValue)}</p>
    </div>
  );
}

export function CategoryStockDonut({ data, loading }: { data: CategoryStockPoint[]; loading: boolean }) {
  const empty = data.length === 0 || data.every((point) => point.stockValue === 0);

  return (
    <ChartCard
      title="Stock Value by Category"
      subtitle="Cost value distribution"
      loading={loading}
      empty={empty}
      emptyMessage="No category stock data yet."
    >
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} dataKey="stockValue" nameKey="category" innerRadius={64} outerRadius={92} paddingAngle={2} strokeWidth={0}>
            {data.map((point, index) => (
              <Cell key={point.category} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CategoryTooltip />} />
          <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 12, color: "#334155" }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
