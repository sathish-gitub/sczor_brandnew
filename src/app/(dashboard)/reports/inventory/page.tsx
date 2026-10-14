"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DataTable } from "@/components/reports/DataTable";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { ExportButtons } from "@/components/reports/ExportButtons";
import { StatCard } from "@/components/reports/StatCard";
import { CategoryStockDonut, type CategoryStockPoint } from "@/components/charts/CategoryStockDonut";
import { StockMovementTrendChart, type StockMovementTrendPoint } from "@/components/charts/StockMovementTrendChart";
import { TopMovingProductsBarChart, type TopMovingProductPoint } from "@/components/charts/TopMovingProductsBarChart";
import { InventoryReportTabs } from "@/components/inventory/InventoryReportTabs";
import { useAccess } from "@/contexts/AccessContext";
import { formatPeriodRange, toExportSalonDetails } from "@/lib/exportReport";

type ReplenishmentRow = {
  productId: string;
  productName: string;
  currentStock: number;
  reorderLevel: number;
  status: "REORDER_NOW" | "LOW" | "OK";
  statusLabel: string;
  suggestedReorderQty: number;
};

type MovementHistoryRow = {
  id: string;
  date: string;
  productName: string;
  type: string;
  typeLabel: string;
  quantity: number;
  reasonOrNotes: string;
  enteredBy: string;
};

type InventoryReportPayload = {
  stockValuation: {
    totalCostValue: number;
    totalSoldValue: number;
    totalProducts: number;
    totalUnits: number;
  };
  stockOutBreakdown: { sales: number; usage: number; wastage: number };
  topMovingProducts: TopMovingProductPoint[];
  slowMovingProducts: Array<{ name: string; unitsSold: number; daysSinceLastSale: number }>;
  stockMovementTrend: StockMovementTrendPoint[];
  categoryBreakdown: CategoryStockPoint[];
  purchaseOrderSummary: { totalOrders: number; pendingOrders: number; totalSpend: number };
  movementHistory: MovementHistoryRow[];
  movementHistoryTruncated: boolean;
  replenishment: ReplenishmentRow[];
};

const MOVEMENT_TYPE_FILTERS = [
  { value: "ALL", label: "All Types" },
  { value: "PURCHASE", label: "Purchase" },
  { value: "SALE", label: "Sale" },
  { value: "USAGE", label: "Usage" },
  { value: "WASTAGE", label: "Wastage" },
  { value: "MANUAL", label: "Manual" },
];

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
  const access = useAccess();
  const [range, setRange] = useState(last30DaysRange());
  const [movementType, setMovementType] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<InventoryReportPayload | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ startDate: range.startDate, endDate: range.endDate });
      if (movementType !== "ALL") {
        params.set("movementType", movementType);
      }

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
  }, [range.startDate, range.endDate, movementType]);

  return (
    <div className="space-y-5">
      <InventoryReportTabs />

      <header className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Inventory Reports</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Stock valuation, movement trends, and product performance.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker value={range} onChange={setRange} />
          <ExportButtons
            disabled={!data}
            getConfig={() => ({
              title: "Inventory Summary",
              salon: toExportSalonDetails(access),
              ...formatPeriodRange(range.startDate, range.endDate),
              generatedBy: access.userName,
              summary: data
                ? [
                    { label: "Stock Value (Cost)", value: data.stockValuation.totalCostValue, type: "currency" },
                    { label: "Total Sold Value", value: data.stockValuation.totalSoldValue, type: "currency" },
                    { label: "Total Products", value: data.stockValuation.totalProducts, type: "number" },
                    { label: "Total Stock Units", value: data.stockValuation.totalUnits, type: "number" },
                    { label: "Stock Out — Sales", value: data.stockOutBreakdown.sales, type: "number" },
                    { label: "Stock Out — Usage", value: data.stockOutBreakdown.usage, type: "number" },
                    { label: "Stock Out — Wastage", value: data.stockOutBreakdown.wastage, type: "number" },
                  ]
                : undefined,
              columns: [
                { header: "Product", key: "name", type: "text" },
                { header: "Units Sold", key: "unitsSold", type: "number" },
                { header: "Days Since Last Sale", key: "daysSinceLastSale", type: "number" },
              ],
              rows: data?.slowMovingProducts ?? [],
              extraSections: [
                {
                  title: "Top Moving Products",
                  columns: [
                    { header: "Product", key: "name", type: "text" },
                    { header: "Units Sold", key: "unitsSold", type: "number" },
                  ],
                  rows: data?.topMovingProducts ?? [],
                },
                {
                  title: "Purchase Order Summary",
                  columns: [
                    { header: "Total Orders", key: "totalOrders", type: "number" },
                    { header: "Pending Orders", key: "pendingOrders", type: "number" },
                    { header: "Total Spend (Received)", key: "totalSpend", type: "currency" },
                  ],
                  rows: data ? [data.purchaseOrderSummary] : [],
                },
                {
                  title: "Stock Valuation",
                  columns: [
                    { header: "Total Cost Value", key: "totalCostValue", type: "currency" },
                    { header: "Total Sold Value", key: "totalSoldValue", type: "currency" },
                    { header: "Total Products", key: "totalProducts", type: "number" },
                    { header: "Total Units in Stock", key: "totalUnits", type: "number" },
                  ],
                  rows: data ? [data.stockValuation] : [],
                },
                {
                  title: "Stock Out Breakdown",
                  columns: [
                    { header: "Sales", key: "sales", type: "number" },
                    { header: "Usage", key: "usage", type: "number" },
                    { header: "Wastage", key: "wastage", type: "number" },
                  ],
                  rows: data ? [data.stockOutBreakdown] : [],
                },
                {
                  title: "Stock Movement History",
                  columns: [
                    { header: "Date", key: "date", type: "date" },
                    { header: "Product", key: "productName", type: "text" },
                    { header: "Type", key: "typeLabel", type: "text" },
                    { header: "Quantity", key: "quantity", type: "number" },
                    { header: "Reason / Notes", key: "reasonOrNotes", type: "text" },
                    { header: "Entered By", key: "enteredBy", type: "text" },
                  ],
                  rows: data?.movementHistory ?? [],
                },
                {
                  title: "Replenishment",
                  columns: [
                    { header: "Product", key: "productName", type: "text" },
                    { header: "Current Stock", key: "currentStock", type: "number" },
                    { header: "Reorder Level", key: "reorderLevel", type: "number" },
                    { header: "Status", key: "statusLabel", type: "text" },
                    { header: "Suggested Reorder Qty", key: "suggestedReorderQty", type: "number" },
                  ],
                  rows: data?.replenishment ?? [],
                },
              ],
              filename: `sczor-inventory-summary-${range.startDate}_to_${range.endDate}`,
            })}
          />
        </div>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Cost Value" value={formatCurrency(data?.stockValuation.totalCostValue ?? 0)} />
        <StatCard label="Total Sold Value" value={formatCurrency(data?.stockValuation.totalSoldValue ?? 0)} />
        <StatCard label="Total Products" value={data?.stockValuation.totalProducts ?? 0} />
        <StatCard label="Total Units in Stock" value={data?.stockValuation.totalUnits ?? 0} />
      </section>

      <section className="grid grid-cols-3 gap-3">
        <StatCard label="Stock Out — Sales" value={data?.stockOutBreakdown.sales ?? 0} />
        <StatCard label="Stock Out — Usage" value={data?.stockOutBreakdown.usage ?? 0} />
        <StatCard label="Stock Out — Wastage" value={data?.stockOutBreakdown.wastage ?? 0} />
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

      <section className="rounded-xl border border-[var(--border)] bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-[var(--foreground)]">Stock Movement History</h2>
            <p className="text-xs text-[var(--muted)]">All stock movements in the selected date range.</p>
          </div>
          <select
            value={movementType}
            onChange={(event) => setMovementType(event.target.value)}
            className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm"
          >
            {MOVEMENT_TYPE_FILTERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {data?.movementHistoryTruncated ? (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            This range has too many movements to display. Please narrow the date range.
          </div>
        ) : null}

        <DataTable
          columns={[
            { key: "date", label: "Date", sortable: true, render: (row) => row.date, sortValue: (row) => row.date },
            { key: "productName", label: "Product", sortable: true, render: (row) => row.productName, sortValue: (row) => row.productName },
            { key: "typeLabel", label: "Type", sortable: true, render: (row) => row.typeLabel, sortValue: (row) => row.typeLabel },
            { key: "quantity", label: "Quantity", sortable: true, render: (row) => row.quantity, sortValue: (row) => row.quantity },
            { key: "reasonOrNotes", label: "Reason / Notes", render: (row) => row.reasonOrNotes },
            { key: "enteredBy", label: "Entered By", render: (row) => row.enteredBy },
          ]}
          rows={data?.movementHistory ?? []}
          pageSize={25}
          emptyText="No stock movements found for the selected filters."
        />
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-4">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-[var(--foreground)]">Replenishment</h2>
          <p className="text-xs text-[var(--muted)]">Current stock vs reorder level for all active products.</p>
        </div>

        <DataTable
          columns={[
            { key: "productName", label: "Product", sortable: true, render: (row) => row.productName, sortValue: (row) => row.productName },
            { key: "currentStock", label: "Current Stock", sortable: true, render: (row) => row.currentStock, sortValue: (row) => row.currentStock },
            { key: "reorderLevel", label: "Reorder Level", sortable: true, render: (row) => row.reorderLevel, sortValue: (row) => row.reorderLevel },
            {
              key: "statusLabel",
              label: "Status",
              sortable: true,
              sortValue: (row) => row.status,
              render: (row) =>
                row.status === "REORDER_NOW" ? (
                  <Link href={`/inventory/purchase-orders/new?productId=${row.productId}`} className="font-semibold text-red-600 underline">
                    {row.statusLabel}
                  </Link>
                ) : row.status === "LOW" ? (
                  <span className="font-semibold text-amber-600">{row.statusLabel}</span>
                ) : (
                  <span className="text-emerald-600">{row.statusLabel}</span>
                ),
            },
            { key: "suggestedReorderQty", label: "Suggested Reorder Qty", sortable: true, render: (row) => row.suggestedReorderQty, sortValue: (row) => row.suggestedReorderQty },
          ]}
          rows={data?.replenishment ?? []}
          pageSize={25}
          emptyText="No active products found."
        />
      </section>
    </div>
  );
}
