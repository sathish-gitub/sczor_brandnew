"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { ChartCard } from "./ChartCard";

export type ServicePopularityPoint = { name: string; count: number; revenue: number };

const COLORS = ["#1E40AF", "#2563EB", "#3B82F6", "#7C3AED", "#0D9488", "#0891B2"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function ServiceTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ServicePopularityPoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-[var(--foreground)]">{point.name}</p>
      <p className="text-[var(--muted)]">{point.count} appointments</p>
      <p className="text-[var(--muted)]">{formatCurrency(point.revenue)}</p>
    </div>
  );
}

export function ServicePopularityDonut({ data, loading }: { data: ServicePopularityPoint[]; loading: boolean }) {
  const empty = data.length === 0;
  const total = data.reduce((sum, point) => sum + point.count, 0);

  return (
    <ChartCard
      title="Service Popularity"
      subtitle="Top services by appointment count"
      loading={loading}
      empty={empty}
      emptyMessage="No services booked in this period."
    >
      <div className="relative">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="name"
              innerRadius={64}
              outerRadius={92}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((point, index) => (
                <Cell key={point.name} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ServiceTooltip />} />
            <Legend
              layout="vertical"
              verticalAlign="middle"
              align="right"
              formatter={(value: string, entry) => {
                const payload = (entry as unknown as { payload: ServicePopularityPoint }).payload;
                const percent = total > 0 ? Math.round((payload.count / total) * 100) : 0;
                return `${value} (${percent}%)`;
              }}
              wrapperStyle={{ fontSize: 12, color: "#334155" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute left-[36%] top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <p className="text-xl font-bold text-[var(--foreground)]">{total}</p>
          <p className="text-[11px] text-[var(--muted)]">Total</p>
        </div>
      </div>
    </ChartCard>
  );
}
