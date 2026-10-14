"use client";

import { useEffect, useMemo, useState } from "react";

import { DataTable } from "@/components/reports/DataTable";
import { FilterChips } from "@/components/reports/FilterChips";
import { StatCard } from "@/components/reports/StatCard";
import { InventoryReportTabs } from "@/components/inventory/InventoryReportTabs";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { useAccess } from "@/contexts/AccessContext";
import { formatFiltersLabel, formatPeriodRange, toExportSalonDetails } from "@/lib/exportReport";
import { todayISTDateString } from "@/lib/time";

type UsageRow = {
  id: string;
  periodStart: string | null;
  periodEnd: string | null;
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  unit: string;
  notes: string;
  costValue: number;
  enteredBy: string;
};

type UsageRowWithLabel = UsageRow & { periodLabel: string };

type ByProductRow = {
  productId: string;
  productName: string;
  category: string;
  totalQuantity: number;
  unit: string;
  entries: number;
  averagePerWeek: number;
  currentStock: number;
  reorderLevel: number;
  status: "REORDER_NOW" | "LOW" | "OK";
  statusLabel: string;
  suggestedReorderQty: number;
};

type Payload = {
  rows: UsageRow[];
  byProduct: ByProductRow[];
  summary: { totalEntries: number; totalQuantity: number; totalCostValue: number; productsUsed: number };
};

type ProductOption = { id: string; name: string };
type CategoryOption = { id: string; name: string };

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { startDate: toDateString(start), endDate: toDateString(now) };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function formatDDMMYYYY(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function formatPeriodLabel(periodStart: string | null, periodEnd: string | null) {
  if (!periodStart || !periodEnd) {
    return "-";
  }

  const [, startMonth, startDay] = periodStart.split("-");
  const [, endMonth, endDay] = periodEnd.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const start = `${Number(startDay)} ${months[Number(startMonth) - 1]}`;
  const end = `${Number(endDay)} ${months[Number(endMonth) - 1]}`;
  return `${start} - ${end}`;
}

export default function UsageReportPage() {
  const access = useAccess();
  const [range, setRange] = useState(monthRange());
  const [productId, setProductId] = useState("");
  const [categoryId, setCategoryId] = useState("ALL");

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<Payload | null>(null);

  const today = todayISTDateString();

  useEffect(() => {
    let active = true;

    async function loadOptions() {
      const productsResponse = await fetch("/api/inventory/products", { cache: "no-store" });
      const categoriesResponse = await fetch("/api/inventory/categories", { cache: "no-store" });

      const productsPayload = (await productsResponse.json().catch(() => null)) as { items?: ProductOption[] } | null;
      const categoriesPayload = (await categoriesResponse.json().catch(() => null)) as { items?: CategoryOption[] } | null;

      if (!active) {
        return;
      }

      setProducts(productsPayload?.items ?? []);
      setCategories(categoriesPayload?.items ?? []);
    }

    loadOptions();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadReport() {
      setLoading(true);
      setError(null);

      if (range.endDate < range.startDate) {
        setError("To Date cannot be before From Date.");
        setLoading(false);
        return;
      }

      const params = new URLSearchParams({ startDate: range.startDate, endDate: range.endDate });
      if (productId) params.set("productId", productId);
      if (categoryId !== "ALL") params.set("categoryId", categoryId);

      const response = await fetch(`/api/reports/inventory/usage?${params.toString()}`, { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as (Payload & { error?: string }) | null;

      if (!active) {
        return;
      }

      if (!response.ok || !data) {
        setError(data?.error ?? "Unable to load usage report.");
        setLoading(false);
        return;
      }

      setPayload(data);
      setLoading(false);
    }

    loadReport();

    return () => {
      active = false;
    };
  }, [range.startDate, range.endDate, productId, categoryId]);

  const productOptions = useMemo(
    () => products.map((product) => ({ value: product.id, label: product.name })),
    [products],
  );

  const rowsWithLabel: UsageRowWithLabel[] = useMemo(
    () => (payload?.rows ?? []).map((row) => ({ ...row, periodLabel: formatPeriodLabel(row.periodStart, row.periodEnd) })),
    [payload],
  );

  return (
    <div className="space-y-5">
      <InventoryReportTabs />

      <header className="rounded-xl border border-[var(--border)] bg-white p-4">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Usage Report</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Products consumed internally, for example in services.</p>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <input
            type="date"
            value={range.startDate}
            max={today}
            onChange={(event) => setRange((current) => ({ ...current, startDate: event.target.value }))}
            className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm"
          />
          <input
            type="date"
            value={range.endDate}
            max={today}
            onChange={(event) => setRange((current) => ({ ...current, endDate: event.target.value }))}
            className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm"
          />
          <div className="w-56">
            <SearchableCombobox
              value={productId}
              onChange={setProductId}
              options={productOptions}
              placeholder="All Products"
              clearLabel="All Products"
              searchPlaceholder="Search products..."
            />
          </div>
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm"
          >
            <option value="ALL">All Categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl border border-[var(--border)] bg-white" />
      ) : payload ? (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Total Entries" value={payload.summary.totalEntries} />
            <StatCard label="Total Quantity" value={payload.summary.totalQuantity} />
            <StatCard label="Total Cost Value" value={formatCurrency(payload.summary.totalCostValue)} />
            <StatCard label="Products Used" value={payload.summary.productsUsed} />
          </section>

          <DataTable
            columns={[
              {
                key: "periodLabel",
                label: "Period",
                sortable: true,
                render: (row) => row.periodLabel,
                sortValue: (row) => row.periodEnd ?? "",
              },
              { key: "productName", label: "Product", sortable: true, render: (row) => row.productName, sortValue: (row) => row.productName },
              { key: "category", label: "Category", sortable: true, render: (row) => row.category, sortValue: (row) => row.category },
              { key: "quantity", label: "Quantity", sortable: true, render: (row) => row.quantity, sortValue: (row) => row.quantity },
              { key: "unit", label: "Unit", render: (row) => row.unit },
              { key: "notes", label: "Notes", render: (row) => row.notes || "-" },
              { key: "costValue", label: "Cost Value", sortable: true, render: (row) => formatCurrency(row.costValue), sortValue: (row) => row.costValue },
              { key: "enteredBy", label: "Entered By", render: (row) => row.enteredBy },
            ]}
            rows={rowsWithLabel}
            pageSize={25}
            emptyText="No usage entries found for the selected filters."
            filterChips={
              <FilterChips
                chips={[
                  { label: "Date Range", value: `${formatDDMMYYYY(range.startDate)} - ${formatDDMMYYYY(range.endDate)}` },
                  productId ? { label: "Product", value: products.find((p) => p.id === productId)?.name ?? productId, onClear: () => setProductId("") } : null,
                  categoryId !== "ALL"
                    ? { label: "Category", value: categories.find((c) => c.id === categoryId)?.name ?? categoryId, onClear: () => setCategoryId("ALL") }
                    : null,
                ]}
              />
            }
            exportConfig={{
              title: "Usage Report",
              salon: toExportSalonDetails(access),
              ...formatPeriodRange(range.startDate, range.endDate),
              filtersLabel: formatFiltersLabel([
                productId ? { label: "Product", value: products.find((p) => p.id === productId)?.name ?? productId } : null,
                categoryId !== "ALL" ? { label: "Category", value: categories.find((c) => c.id === categoryId)?.name ?? categoryId } : null,
              ]),
              generatedBy: access.userName,
              summary: [
                { label: "Total Entries", value: payload.summary.totalEntries, type: "number" },
                { label: "Total Quantity", value: payload.summary.totalQuantity, type: "number" },
                { label: "Total Cost Value", value: payload.summary.totalCostValue, type: "currency" },
                { label: "Products Used", value: payload.summary.productsUsed, type: "number" },
              ],
              columns: [
                { header: "Period", key: "periodLabel", type: "text" },
                { header: "Product", key: "productName", type: "text" },
                { header: "Category", key: "category", type: "text" },
                { header: "Quantity", key: "quantity", type: "number" },
                { header: "Unit", key: "unit", type: "text" },
                { header: "Notes", key: "notes", type: "text" },
                { header: "Cost Value", key: "costValue", type: "currency" },
                { header: "Entered By", key: "enteredBy", type: "text" },
              ],
              totals: {
                quantity: payload.summary.totalQuantity,
                costValue: payload.summary.totalCostValue,
              },
              extraSections: [
                {
                  title: "Usage by Product",
                  columns: [
                    { header: "Product", key: "productName", type: "text" },
                    { header: "Category", key: "category", type: "text" },
                    { header: "Total Quantity", key: "totalQuantity", type: "number" },
                    { header: "Entries", key: "entries", type: "number" },
                    { header: "Avg / Week", key: "averagePerWeek", type: "number" },
                    { header: "Current Stock", key: "currentStock", type: "number" },
                    { header: "Reorder Level", key: "reorderLevel", type: "number" },
                    { header: "Replenishment", key: "statusLabel", type: "text" },
                  ],
                  rows: payload.byProduct,
                },
              ],
              filename: `sczor-usage-report-${range.startDate}_to_${range.endDate}`,
            }}
          />

          <section className="rounded-xl border border-[var(--border)] bg-white p-4">
            <div className="mb-3">
              <h2 className="text-base font-semibold text-[var(--foreground)]">Usage by Product</h2>
              <p className="text-xs text-[var(--muted)]">Totals for the selected date range, with replenishment status.</p>
            </div>

            {payload.byProduct.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No usage data to show.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                    <tr>
                      <th className="py-2">Product</th>
                      <th className="py-2">Total Quantity</th>
                      <th className="py-2">Entries</th>
                      <th className="py-2">Avg / Week</th>
                      <th className="py-2">Current Stock</th>
                      <th className="py-2">Reorder Level</th>
                      <th className="py-2">Replenishment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.byProduct.map((item) => (
                      <tr key={item.productId} className="border-t border-[var(--border)]">
                        <td className="py-2 font-semibold">{item.productName}</td>
                        <td className="py-2">{item.totalQuantity} {item.unit}</td>
                        <td className="py-2">{item.entries}</td>
                        <td className="py-2">{item.averagePerWeek}</td>
                        <td className="py-2">{item.currentStock}</td>
                        <td className="py-2">{item.reorderLevel}</td>
                        <td className="py-2">
                          {item.status === "REORDER_NOW" ? (
                            <a
                              href={`/inventory/purchase-orders/new?productId=${item.productId}`}
                              className="font-semibold text-red-600 underline"
                            >
                              {item.statusLabel}
                            </a>
                          ) : item.status === "LOW" ? (
                            <span className="font-semibold text-amber-600">{item.statusLabel}</span>
                          ) : (
                            <span className="text-emerald-600">{item.statusLabel}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
