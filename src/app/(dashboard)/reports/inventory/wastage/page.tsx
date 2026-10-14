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

const WASTAGE_REASONS = ["Expired", "Damaged", "Spilled", "Lost", "Other"] as const;

type WastageRow = {
  id: string;
  date: string;
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  unit: string;
  reason: string;
  notes: string;
  costValue: number;
  enteredBy: string;
};

type ReplenishmentRow = {
  productId: string;
  productName: string;
  currentStock: number;
  reorderLevel: number;
  status: "REORDER_NOW" | "LOW" | "OK";
  statusLabel: string;
  suggestedReorderQty: number;
};

type Payload = {
  rows: WastageRow[];
  summary: { totalEntries: number; totalQuantity: number; totalCostValue: number; topReason: string };
  replenishment: ReplenishmentRow[];
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

export default function WastageReportPage() {
  const access = useAccess();
  const [range, setRange] = useState(monthRange());
  const [productId, setProductId] = useState("");
  const [categoryId, setCategoryId] = useState("ALL");
  const [reason, setReason] = useState("ALL");

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<Payload | null>(null);

  const today = todayISTDateString();

  useEffect(() => {
    let active = true;

    async function loadOptions() {
      const [productsResponse, categoriesResponse] = [
        await fetch("/api/inventory/products", { cache: "no-store" }),
        await fetch("/api/inventory/categories", { cache: "no-store" }),
      ];

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
      if (reason !== "ALL") params.set("reason", reason);

      const response = await fetch(`/api/reports/inventory/wastage?${params.toString()}`, { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as (Payload & { error?: string }) | null;

      if (!active) {
        return;
      }

      if (!response.ok || !data) {
        setError(data?.error ?? "Unable to load wastage report.");
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
  }, [range.startDate, range.endDate, productId, categoryId, reason]);

  const productOptions = useMemo(
    () => products.map((product) => ({ value: product.id, label: product.name })),
    [products],
  );

  return (
    <div className="space-y-5">
      <InventoryReportTabs />

      <header className="rounded-xl border border-[var(--border)] bg-white p-4">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Wastage Report</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Products written off due to expiry, damage, or loss.</p>

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
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm"
          >
            <option value="ALL">All Reasons</option>
            {WASTAGE_REASONS.map((item) => (
              <option key={item} value={item}>
                {item}
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
            <StatCard label="Top Reason" value={payload.summary.topReason} />
          </section>

          <DataTable
            columns={[
              { key: "date", label: "Date", sortable: true, render: (row) => formatDDMMYYYY(row.date), sortValue: (row) => row.date },
              { key: "productName", label: "Product", sortable: true, render: (row) => row.productName, sortValue: (row) => row.productName },
              { key: "category", label: "Category", sortable: true, render: (row) => row.category, sortValue: (row) => row.category },
              { key: "quantity", label: "Quantity", sortable: true, render: (row) => row.quantity, sortValue: (row) => row.quantity },
              { key: "unit", label: "Unit", render: (row) => row.unit },
              { key: "reason", label: "Reason", sortable: true, render: (row) => row.reason, sortValue: (row) => row.reason },
              { key: "notes", label: "Notes", render: (row) => row.notes || "-" },
              { key: "costValue", label: "Cost Value", sortable: true, render: (row) => formatCurrency(row.costValue), sortValue: (row) => row.costValue },
              { key: "enteredBy", label: "Entered By", render: (row) => row.enteredBy },
            ]}
            rows={payload.rows}
            pageSize={25}
            emptyText="No wastage entries found for the selected filters."
            filterChips={
              <FilterChips
                chips={[
                  { label: "Date Range", value: `${formatDDMMYYYY(range.startDate)} - ${formatDDMMYYYY(range.endDate)}` },
                  productId ? { label: "Product", value: products.find((p) => p.id === productId)?.name ?? productId, onClear: () => setProductId("") } : null,
                  categoryId !== "ALL"
                    ? { label: "Category", value: categories.find((c) => c.id === categoryId)?.name ?? categoryId, onClear: () => setCategoryId("ALL") }
                    : null,
                  reason !== "ALL" ? { label: "Reason", value: reason, onClear: () => setReason("ALL") } : null,
                ]}
              />
            }
            exportConfig={{
              title: "Wastage Report",
              salon: toExportSalonDetails(access),
              ...formatPeriodRange(range.startDate, range.endDate),
              filtersLabel: formatFiltersLabel([
                productId ? { label: "Product", value: products.find((p) => p.id === productId)?.name ?? productId } : null,
                categoryId !== "ALL" ? { label: "Category", value: categories.find((c) => c.id === categoryId)?.name ?? categoryId } : null,
                reason !== "ALL" ? { label: "Reason", value: reason } : null,
              ]),
              generatedBy: access.userName,
              summary: [
                { label: "Total Entries", value: payload.summary.totalEntries, type: "number" },
                { label: "Total Quantity", value: payload.summary.totalQuantity, type: "number" },
                { label: "Total Cost Value", value: payload.summary.totalCostValue, type: "currency" },
                { label: "Top Reason", value: payload.summary.topReason, type: "text" },
              ],
              columns: [
                { header: "Date", key: "date", type: "date" },
                { header: "Product", key: "productName", type: "text" },
                { header: "Category", key: "category", type: "text" },
                { header: "Quantity", key: "quantity", type: "number" },
                { header: "Unit", key: "unit", type: "text" },
                { header: "Reason", key: "reason", type: "text" },
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
                  title: "Replenishment",
                  columns: [
                    { header: "Product", key: "productName", type: "text" },
                    { header: "Current Stock", key: "currentStock", type: "number" },
                    { header: "Reorder Level", key: "reorderLevel", type: "number" },
                    { header: "Status", key: "statusLabel", type: "text" },
                    { header: "Suggested Reorder Qty", key: "suggestedReorderQty", type: "number" },
                  ],
                  rows: payload.replenishment,
                },
              ],
              filename: `sczor-wastage-report-${range.startDate}_to_${range.endDate}`,
            }}
          />

          <section className="rounded-xl border border-[var(--border)] bg-white p-4">
            <div className="mb-3">
              <h2 className="text-base font-semibold text-[var(--foreground)]">Replenishment</h2>
              <p className="text-xs text-[var(--muted)]">Products involved in the wastage entries above, by current stock status.</p>
            </div>

            {payload.replenishment.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No products to show.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[640px] w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                    <tr>
                      <th className="py-2">Product</th>
                      <th className="py-2">Current Stock</th>
                      <th className="py-2">Reorder Level</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Suggested Reorder Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.replenishment.map((item) => (
                      <tr key={item.productId} className="border-t border-[var(--border)]">
                        <td className="py-2 font-semibold">{item.productName}</td>
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
                        <td className="py-2">{item.suggestedReorderQty}</td>
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
