"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { ChartCard } from "./ChartCard";

export type SubscriptionDistributionPoint = { plan: string; count: number };

const PLAN_COLORS: Record<string, string> = {
  Trial: "#94A3B8",
  Monthly: "#2563EB",
  Yearly: "#10B981",
  Business: "#8B5CF6",
};

function SubscriptionTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ payload: SubscriptionDistributionPoint }>;
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const percent = total > 0 ? Math.round((point.count / total) * 100) : 0;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-[var(--foreground)]">{point.plan}</p>
      <p className="text-[var(--muted)]">
        {point.count} salons ({percent}%)
      </p>
    </div>
  );
}

export function SubscriptionDistributionDonut({ data, loading }: { data: SubscriptionDistributionPoint[]; loading: boolean }) {
  const empty = data.length === 0 || data.every((point) => point.count === 0);
  const total = data.reduce((sum, point) => sum + point.count, 0);

  return (
    <ChartCard
      title="Subscription Distribution"
      subtitle="Current active plans"
      loading={loading}
      empty={empty}
      emptyMessage="No salons yet."
    >
      <div className="relative">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="plan" innerRadius={64} outerRadius={92} paddingAngle={2} strokeWidth={0}>
              {data.map((point) => (
                <Cell key={point.plan} fill={PLAN_COLORS[point.plan] ?? "#94A3B8"} />
              ))}
            </Pie>
            <Tooltip content={<SubscriptionTooltip total={total} />} />
            <Legend
              layout="vertical"
              verticalAlign="middle"
              align="right"
              formatter={(value: string, entry) => {
                const payload = (entry as unknown as { payload: SubscriptionDistributionPoint }).payload;
                const percent = total > 0 ? Math.round((payload.count / total) * 100) : 0;
                return `${value} (${percent}%)`;
              }}
              wrapperStyle={{ fontSize: 12, color: "#334155" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute left-[36%] top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <p className="text-xl font-bold text-[var(--foreground)]">{total}</p>
          <p className="text-[11px] text-[var(--muted)]">Salons</p>
        </div>
      </div>
    </ChartCard>
  );
}
