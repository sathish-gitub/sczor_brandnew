"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { ChartCard } from "./ChartCard";

export type LoyaltyTierPoint = { tier: string; count: number };

const TIER_COLORS: Record<string, string> = {
  Bronze: "#B45309",
  Silver: "#64748B",
  Gold: "#D97706",
  Platinum: "#0EA5E9",
};

function LoyaltyTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: LoyaltyTierPoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-[var(--foreground)]">{point.tier}</p>
      <p className="text-[var(--muted)]">{point.count} customers</p>
    </div>
  );
}

export function LoyaltyTierDonut({ data, loading }: { data: LoyaltyTierPoint[]; loading: boolean }) {
  const empty = data.length === 0 || data.every((point) => point.count === 0);

  return (
    <ChartCard
      title="Loyalty Tier Distribution"
      subtitle="Current customer tiers"
      loading={loading}
      empty={empty}
      emptyMessage="No loyalty cards yet."
    >
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="tier" innerRadius={64} outerRadius={92} paddingAngle={2} strokeWidth={0}>
            {data.map((point) => (
              <Cell key={point.tier} fill={TIER_COLORS[point.tier] ?? "#94A3B8"} />
            ))}
          </Pie>
          <Tooltip content={<LoyaltyTooltip />} />
          <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 12, color: "#334155" }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
