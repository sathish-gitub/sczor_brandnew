"use client";

import Link from "next/link";
import { Info } from "lucide-react";
import { useEffect, useState } from "react";

import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { StatCard } from "@/components/reports/StatCard";
import { PLTrendChart, type PLTrendPoint } from "@/components/charts/PLTrendChart";
import { CategoryAmountDonut, type CategoryAmountPoint } from "@/components/charts/CategoryAmountDonut";

type PLPayload = {
  current: {
    revenue: { serviceRevenue: number; productRevenue: number; totalRevenue: number };
    cogs: { productCost: number; note: string };
    grossProfit: number;
    grossMarginPercent: number;
    operatingExpenses: {
      payrollCost: number;
      inventoryPurchases: number;
      loyaltyDiscounts: number;
      totalOperatingExpenses: number;
    };
    netProfit: number;
    netMarginPercent: number;
  };
  trend: PLTrendPoint[];
  revenueBreakdown: CategoryAmountPoint[];
  expenseBreakdown: CategoryAmountPoint[];
};

const REVENUE_COLORS = ["#1E40AF", "#0EA5E9"];
const EXPENSE_COLORS = ["#DC2626", "#D97706", "#7C3AED", "#64748B"];

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { startDate: toDateString(start), endDate: toDateString(end) };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export default function ProfitLossReportPage() {
  const [range, setRange] = useState(currentMonthRange());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PLPayload | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ startDate: range.startDate, endDate: range.endDate });

      try {
        const response = await fetch(`/api/reports/profit-loss?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as PLPayload & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load profit & loss report.");
        }

        if (!active) {
          return;
        }

        setData(payload);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load profit & loss report.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [range.startDate, range.endDate]);

  const pl = data?.current;
  const netProfitPositive = (pl?.netProfit ?? 0) >= 0;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Profit & Loss Analysis</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Revenue, cost of goods, and operating expenses in one financial overview.</p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Revenue" value={formatCurrency(pl?.revenue.totalRevenue ?? 0)} />
        <StatCard label="Total Expenses" value={formatCurrency(pl?.operatingExpenses.totalOperatingExpenses ?? 0)} />
        <StatCard
          label="Net Profit"
          value={formatCurrency(pl?.netProfit ?? 0)}
          valueClassName={netProfitPositive ? "text-emerald-600" : "text-red-600"}
        />
        <StatCard
          label="Net Margin"
          value={`${pl?.netMarginPercent ?? 0}%`}
          valueClassName={netProfitPositive ? "text-emerald-600" : "text-red-600"}
        />
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-5">
        <h2 className="text-base font-semibold text-[var(--foreground)]">Profit & Loss Statement</h2>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          {range.startDate} to {range.endDate}
        </p>

        {loading ? (
          <div className="mt-4 h-72 animate-pulse rounded-xl bg-slate-100" />
        ) : (
          <div className="mt-4 divide-y divide-[var(--border)] text-sm">
            <div className="pb-3">
              <p className="font-bold uppercase tracking-[0.08em] text-[var(--foreground)]">Revenue</p>
              <StatementRow label="Service Revenue" value={pl?.revenue.serviceRevenue ?? 0} />
              <StatementRow label="Retail Product Revenue" value={pl?.revenue.productRevenue ?? 0} />
              <StatementRow label="Total Revenue" value={pl?.revenue.totalRevenue ?? 0} bold />
            </div>

            <div className="py-3">
              <p className="font-bold uppercase tracking-[0.08em] text-[var(--foreground)]">Cost of Goods Sold</p>
              <StatementRow label="Product Costs" value={pl?.cogs.productCost ?? 0} negative />
              <p className="mt-1 text-xs italic text-[var(--muted)]">{pl?.cogs.note}</p>
            </div>

            <div className="py-3">
              <StatementRow label="Gross Profit" value={pl?.grossProfit ?? 0} bold large />
              <StatementRow label="Gross Margin" value={`${pl?.grossMarginPercent ?? 0}%`} muted />
            </div>

            <div className="py-3">
              <p className="font-bold uppercase tracking-[0.08em] text-[var(--foreground)]">Operating Expenses</p>
              <StatementRow label="Staff Payroll" value={pl?.operatingExpenses.payrollCost ?? 0} negative />
              <div className="flex items-start gap-1.5">
                <StatementRow label="Inventory Purchases" value={pl?.operatingExpenses.inventoryPurchases ?? 0} negative className="flex-1" />
                <span className="mt-1.5 shrink-0" title="Reflects purchases MADE in this period, which may not perfectly align with products SOLD in the same period (cash basis vs matching basis).">
                  <Info className="h-3.5 w-3.5 text-[var(--muted)]" />
                </span>
              </div>
              <StatementRow label="Loyalty Discounts" value={pl?.operatingExpenses.loyaltyDiscounts ?? 0} negative />
              <StatementRow label="Total Expenses" value={pl?.operatingExpenses.totalOperatingExpenses ?? 0} bold />
            </div>

            <div className="pt-3">
              <StatementRow label="Net Profit" value={pl?.netProfit ?? 0} bold large highlight={netProfitPositive ? "positive" : "negative"} />
              <StatementRow label="Net Margin" value={`${pl?.netMarginPercent ?? 0}%`} muted />
            </div>
          </div>
        )}
      </section>

      <PLTrendChart data={data?.trend ?? []} loading={loading} />

      <div className="grid gap-5 xl:grid-cols-2">
        <CategoryAmountDonut
          title="Revenue Breakdown"
          subtitle="Services vs retail products"
          data={data?.revenueBreakdown ?? []}
          colors={REVENUE_COLORS}
          loading={loading}
          emptyMessage="No revenue in this period."
        />
        <CategoryAmountDonut
          title="Expense Breakdown"
          subtitle="Payroll, purchases, loyalty discounts, and COGS"
          data={data?.expenseBreakdown ?? []}
          colors={EXPENSE_COLORS}
          loading={loading}
          emptyMessage="No expenses in this period."
        />
      </div>
    </div>
  );
}

function StatementRow({
  label,
  value,
  bold,
  large,
  negative,
  muted,
  highlight,
  className = "",
}: {
  label: string;
  value: number | string;
  bold?: boolean;
  large?: boolean;
  negative?: boolean;
  muted?: boolean;
  highlight?: "positive" | "negative";
  className?: string;
}) {
  const displayValue = typeof value === "number" ? formatCurrency(value) : value;

  const valueColor = highlight === "positive" ? "text-emerald-600" : highlight === "negative" ? "text-red-600" : negative ? "text-red-600" : "text-[var(--foreground)]";
  const textSize = large ? "text-lg" : "text-sm";
  const textWeight = bold ? "font-bold" : muted ? "font-medium" : "font-normal";

  return (
    <div className={`flex items-center justify-between py-1.5 ${className}`}>
      <span className={`${muted ? "text-xs text-[var(--muted)]" : `${textSize} ${textWeight} text-[var(--foreground)]`}`}>{label}</span>
      <span className={`${muted ? "text-xs text-[var(--muted)]" : `${textSize} ${textWeight} ${valueColor}`}`}>
        {negative && typeof value === "number" && value > 0 ? "-" : ""}
        {displayValue}
      </span>
    </div>
  );
}
