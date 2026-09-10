"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartCard } from "./ChartCard";

export type AppointmentBreakdownPoint = { status: string; count: number };

const STATUS_COLORS: Record<string, string> = {
  Completed: "#22C55E",
  Booked: "#2563EB",
  Cancelled: "#EF4444",
  "In Progress": "#F59E0B",
};

function AppointmentTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: AppointmentBreakdownPoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-[var(--foreground)]">{point.status}</p>
      <p className="text-[var(--muted)]">{point.count} appointments</p>
    </div>
  );
}

export function AppointmentBarChart({ data, loading }: { data: AppointmentBreakdownPoint[]; loading: boolean }) {
  const empty = data.length === 0 || data.every((point) => point.count === 0);

  return (
    <ChartCard
      title="Appointment Breakdown"
      subtitle="By status, for the selected period"
      loading={loading}
      empty={empty}
      emptyMessage="No appointments in this period."
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2F7" />
          <XAxis dataKey="status" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
          <Tooltip content={<AppointmentTooltip />} cursor={{ fill: "rgba(148, 163, 184, 0.1)" }} />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={56}>
            {data.map((point) => (
              <Cell key={point.status} fill={STATUS_COLORS[point.status] ?? "#94A3B8"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
