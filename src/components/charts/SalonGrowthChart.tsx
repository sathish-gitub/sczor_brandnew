"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartCard } from "./ChartCard";

export type SalonGrowthPoint = { month: string; count: number };

function GrowthTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length || !label) return null;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-[var(--foreground)]">{label}</p>
      <p className="text-[var(--muted)]">{payload[0].value} new salons</p>
    </div>
  );
}

export function SalonGrowthChart({ data, loading }: { data: SalonGrowthPoint[]; loading: boolean }) {
  const empty = data.length === 0 || data.every((point) => point.count === 0);

  return (
    <ChartCard
      title="Salon Growth"
      subtitle="New salon signups per month"
      loading={loading}
      empty={empty}
      emptyMessage="No new salon signups in this period."
    >
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="salonGrowthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1E40AF" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#1E40AF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2F7" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
          <Tooltip content={<GrowthTooltip />} />
          <Area type="monotone" dataKey="count" stroke="#1E40AF" strokeWidth={2.5} fill="url(#salonGrowthGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
