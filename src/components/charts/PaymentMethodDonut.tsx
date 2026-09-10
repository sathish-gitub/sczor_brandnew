"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { ChartCard } from "./ChartCard";

export type PaymentMethodPoint = { method: string; amount: number; count: number };

const METHOD_COLORS: Record<string, string> = {
  Cash: "#22C55E",
  UPI: "#2563EB",
  Card: "#7C3AED",
  Wallet: "#F59E0B",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function PaymentTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: PaymentMethodPoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-[var(--foreground)]">{point.method}</p>
      <p className="text-[var(--muted)]">{formatCurrency(point.amount)}</p>
      <p className="text-[var(--muted)]">{point.count} invoices</p>
    </div>
  );
}

export function PaymentMethodDonut({ data, loading }: { data: PaymentMethodPoint[]; loading: boolean }) {
  const empty = data.length === 0 || data.every((point) => point.amount === 0);

  return (
    <ChartCard
      title="Payment Method Split"
      subtitle="Revenue share by payment method"
      loading={loading}
      empty={empty}
      emptyMessage="No paid invoices in this period."
    >
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} dataKey="amount" nameKey="method" innerRadius={64} outerRadius={92} paddingAngle={2} strokeWidth={0}>
            {data.map((point) => (
              <Cell key={point.method} fill={METHOD_COLORS[point.method] ?? "#94A3B8"} />
            ))}
          </Pie>
          <Tooltip content={<PaymentTooltip />} />
          <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 12, color: "#334155" }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
