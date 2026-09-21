"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartCard } from "./ChartCard";

export type PayrollTrendPoint = { month: string; totalNetPay: number };

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function PayrollTrendTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length || !label) return null;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-[var(--foreground)]">{label}</p>
      <p className="text-[var(--muted)]">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

export function PayrollTrendChart({ data, loading }: { data: PayrollTrendPoint[]; loading: boolean }) {
  const empty = data.length === 0 || data.every((point) => point.totalNetPay === 0);

  return (
    <ChartCard
      title="Payroll Trend"
      subtitle="Total net pay across all staff, last 6 months"
      loading={loading}
      empty={empty}
      emptyMessage="No payroll has been generated yet."
    >
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2F7" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} width={56} />
          <Tooltip content={<PayrollTrendTooltip />} />
          <Line type="monotone" dataKey="totalNetPay" name="Total Net Pay" stroke="#0D9488" strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
