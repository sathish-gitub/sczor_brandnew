"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartCard } from "./ChartCard";

export type CommissionVsBasePoint = { staffName: string; baseSalary: number; commission: number };

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function CommissionVsBaseTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) {
  if (!active || !payload?.length || !label) return null;

  const base = payload.find((item) => item.dataKey === "baseSalary")?.value ?? 0;
  const commission = payload.find((item) => item.dataKey === "commission")?.value ?? 0;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-[var(--foreground)]">{label}</p>
      <p className="text-[#0D9488]">Base Salary: {formatCurrency(base)}</p>
      <p className="text-[#F59E0B]">Commission: {formatCurrency(commission)}</p>
    </div>
  );
}

export function CommissionVsBaseBarChart({ data, loading }: { data: CommissionVsBasePoint[]; loading: boolean }) {
  const empty = data.length === 0;
  const height = Math.max(280, data.length * 42);

  return (
    <ChartCard
      title="Commission vs Base Salary"
      subtitle="Per staff earnings breakdown for the selected month"
      loading={loading}
      empty={empty}
      emptyMessage="No generated payroll for this month yet."
      height={height}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EEF2F7" />
          <XAxis type="number" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="staffName"
            tick={{ fontSize: 12, fill: "#334155" }}
            axisLine={false}
            tickLine={false}
            width={110}
          />
          <Tooltip content={<CommissionVsBaseTooltip />} cursor={{ fill: "rgba(148, 163, 184, 0.1)" }} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#334155" }} />
          <Bar dataKey="baseSalary" name="Base Salary" stackId="pay" fill="#0D9488" radius={[0, 0, 0, 0]} maxBarSize={22} />
          <Bar dataKey="commission" name="Commission" stackId="pay" fill="#F59E0B" radius={[0, 6, 6, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
