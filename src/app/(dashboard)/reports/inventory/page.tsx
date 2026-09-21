"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { StatCard } from "@/components/reports/StatCard";
import { CategoryStockDonut, type CategoryStockPoint } from "@/components/charts/CategoryStockDonut";
import { StockMovementTrendChart, type StockMovementTrendPoint } from "@/components/charts/StockMovementTrendChart";
import { TopMovingProductsBarChart, type TopMovingProductPoint } from "@/components/charts/TopMovingProductsBarChart";

type InventoryReportPayload = {
  stockValuation: {
    totalCostValue: number;
    totalRetailValue: number;
    totalProducts: number;
    totalUnits: number;
  };
  topMovingProducts: TopMovingProductPoint[];
  slowMovingProducts: Array<{ name: string; unitsSold: number; daysSinceLastSale: number }>;
  stockMovementTrend: StockMovementTrendPoint[];
  categoryBreakdown: CategoryStockPoint[];
  purchaseOrderSummary: { totalOrders: number; pendingOrders: number; totalSpend: number };
};

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function last30DaysRange() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);
  return { startDate: toDateString(start), endDate: toDateString(end) };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export default function InventoryReportsPage() {
  const [range, setRange] = useState(last30DaysRange());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<InventoryReportPayload | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ startDate: range.startDate, endDate: range.endDate });

      try {
        const response = await fetch(`/api/reports/inventory?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as InventoryReportPayload & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load inventory report.");
        }

        if (!active) {
          return;
        }

        setData(payload);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load inventory report.");
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

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Inventory Reports</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Stock valuation, movement trends, and product performance.</p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Cost Value" value={formatCurrency(data?.stockValuation.totalCostValue ?? 0)} />
        <StatCard label="Total Retail Value" value={formatCurrency(data?.stockValuation.totalRetailValue ?? 0)} />
        <StatCard label="Total Products" value={data?.stockValuation.totalProducts ?? 0} />
        <StatCard label="Total Units in Stock" value={data?.stockValuation.totalUnits ?? 0} />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <StockMovementTrendChart data={data?.stockMovementTrend ?? []} loading={loading} />
        <CategoryStockDonut data={data?.categoryBreakdown ?? []} loading={loading} />
      </div>

      <TopMovingProductsBarChart data={data?.topMovingProducts ?? []} loading={loading} />

      <section className="rounded-xl border border-[var(--border)] bg-white p-4">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-[var(--foreground)]">Slow Moving Products</h2>
          <p className="text-xs text-[var(--muted)]">Consider promoting or discontinuing items with little to no recent sales.</p>
        </div>

        {loading ? (
          <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
        ) : (data?.slowMovingProducts ?? []).length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No slow-moving product data available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[560px] w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                <tr>
                  <th className="py-2">Product</th>
                  <th className="py-2">Units Sold</th>
                  <th className="py-2">Days Since Last Sale</th>
                </tr>
              </thead>
              <tbody>
                {(data?.slowMovingProducts ?? []).map((row) => (
                  <tr key={row.name} className="border-t border-[var(--border)]">
                    <td className="py-2 font-semibold">{row.name}</td>
                    <td className="py-2">{row.unitsSold === 0 ? <span className="text-red-600">0 (no sales)</span> : row.unitsSold}</td>
                    <td className="py-2">{row.daysSinceLastSale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--foreground)]">Purchase Order Summary</h2>
          <Link href="/inventory/purchase-orders" className="text-xs font-semibold text-[var(--primary)]">
            View purchase orders
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total Orders" value={data?.purchaseOrderSummary.totalOrders ?? 0} />
          <StatCard label="Pending Orders" value={data?.purchaseOrderSummary.pendingOrders ?? 0} />
          <StatCard label="Total Spend (Received)" value={formatCurrency(data?.purchaseOrderSummary.totalSpend ?? 0)} />
        </div>
      </section>
    </div>
  );
}
