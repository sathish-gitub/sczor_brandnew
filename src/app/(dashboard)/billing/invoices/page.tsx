"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ExportButtons } from "@/components/reports/ExportButtons";
import { FilterChips } from "@/components/reports/FilterChips";
import { useAccess } from "@/contexts/AccessContext";
import { formatFiltersLabel, formatPeriodRange, toExportSalonDetails } from "@/lib/exportReport";

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerMobile: string;
  itemsCount: number;
  subtotal: number;
  gst: number;
  discount: number;
  loyaltyDiscount: number;
  total: number;
  paymentMethod: "CASH" | "UPI" | "CARD" | "WALLET";
  paymentStatus: "PENDING" | "PAID" | "CANCELLED" | "REFUNDED";
};

type InvoicesResponse = {
  items: InvoiceRow[];
  pagination: {
    page: number;
    totalPages: number;
    total: number;
  };
  summary: {
    todayRevenue: number;
    monthRevenue: number;
    totalInvoices: number;
    averageInvoiceValue: number;
  };
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

const paymentStatusBadge: Record<InvoiceRow["paymentStatus"], string> = {
  PAID: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REFUNDED: "border-orange-200 bg-orange-50 text-orange-700",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
};

export default function InvoicesPage() {
  const access = useAccess();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("ALL");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<InvoicesResponse | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 250);

    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    let active = true;

    async function loadInvoices() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        paymentMethod,
      });

      if (query) {
        params.set("search", query);
      }

      if (fromDate) {
        params.set("from", fromDate);
      }

      if (toDate) {
        params.set("to", toDate);
      }

      const response = await fetch(`/api/billing/invoices?${params.toString()}`, { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as (InvoicesResponse & { error?: string }) | null;

      if (!active) {
        return;
      }

      if (!response.ok || !data) {
        setError(data?.error ?? "Unable to load invoices.");
        setLoading(false);
        return;
      }

      setPayload(data);
      setLoading(false);
    }

    loadInvoices();

    return () => {
      active = false;
    };
  }, [page, paymentMethod, query, fromDate, toDate]);

  async function getInvoiceExportConfig() {
    const params = new URLSearchParams({
      export: "true",
      paymentMethod,
    });

    if (query) {
      params.set("search", query);
    }

    if (fromDate) {
      params.set("from", fromDate);
    }

    if (toDate) {
      params.set("to", toDate);
    }

    const response = await fetch(`/api/billing/invoices?${params.toString()}`, { cache: "no-store" });
    const data = (await response.json().catch(() => null)) as (InvoicesResponse & { error?: string }) | null;

    if (!response.ok || !data) {
      throw new Error(data?.error ?? "Unable to export invoices.");
    }

    const filtersLabel = formatFiltersLabel([
      paymentMethod !== "ALL" ? { label: "Payment", value: paymentMethod } : null,
      query ? { label: "Search", value: query } : null,
    ]);

    return {
      title: "Invoices",
      salon: toExportSalonDetails(access),
      ...(fromDate || toDate ? formatPeriodRange(fromDate || toDate, toDate || fromDate) : {}),
      filtersLabel,
      generatedBy: access.userName,
      summary: [
        { label: "Today's Revenue", value: data.summary.todayRevenue, type: "currency" as const },
        { label: "This Month Revenue", value: data.summary.monthRevenue, type: "currency" as const },
        { label: "Total Invoices", value: data.summary.totalInvoices, type: "number" as const },
        { label: "Average Invoice Value", value: data.summary.averageInvoiceValue, type: "currency" as const },
      ],
      columns: [
        { header: "Invoice#", key: "invoiceNumber", type: "text" as const },
        { header: "Date", key: "invoiceDate", type: "date" as const },
        { header: "Customer", key: "customerName", type: "text" as const },
        { header: "Items", key: "itemsCount", type: "number" as const },
        { header: "Subtotal", key: "subtotal", type: "currency" as const },
        { header: "GST", key: "gst", type: "currency" as const },
        { header: "Discount", key: "discount", type: "currency" as const },
        { header: "Loyalty Discount", key: "loyaltyDiscount", type: "number" as const },
        { header: "Total", key: "total", type: "currency" as const },
        { header: "Payment", key: "paymentMethod", type: "text" as const },
        { header: "Status", key: "paymentStatus", type: "text" as const },
      ],
      rows: data.items,
      filename: `sczor-invoices-${fromDate || "all"}_to_${toDate || "all"}`,
    };
  }

  const summary = useMemo(
    () =>
      payload?.summary ?? {
        todayRevenue: 0,
        monthRevenue: 0,
        totalInvoices: 0,
        averageInvoiceValue: 0,
      },
    [payload],
  );

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <header className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Invoices</h1>
          <p className="text-sm text-[var(--muted)]">Track revenue and billing activity.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterChips
            chips={[
              paymentMethod !== "ALL" ? { label: "Payment", value: paymentMethod, onClear: () => setPaymentMethod("ALL") } : null,
              search.trim() ? { label: "Search", value: search.trim(), onClear: () => setSearch("") } : null,
              fromDate ? { label: "From", value: fromDate, onClear: () => setFromDate("") } : null,
              toDate ? { label: "To", value: toDate, onClear: () => setToDate("") } : null,
            ]}
          />
          <ExportButtons getConfig={getInvoiceExportConfig} />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] bg-white p-4">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Today&apos;s Revenue</p>
          <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{formatCurrency(summary.todayRevenue)}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-4">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">This Month Revenue</p>
          <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{formatCurrency(summary.monthRevenue)}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-4">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Total Invoices</p>
          <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{summary.totalInvoices}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-4">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Average Invoice Value</p>
          <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{formatCurrency(summary.averageInvoiceValue)}</p>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <input
            type="date"
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm"
          />
          <input
            type="date"
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm"
          />
          <select
            value={paymentMethod}
            onChange={(event) => {
              setPaymentMethod(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm"
          >
            <option value="ALL">All Payment Modes</option>
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="CARD">Card</option>
          </select>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search invoice/customer"
            className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm lg:col-span-2"
          />
        </div>
      </section>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl border border-[var(--border)] bg-white" />
      ) : !payload || payload.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-16 text-center">
          <p className="text-base font-semibold text-[var(--foreground)]">No invoices found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">Invoice#</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Payment</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payload.items.map((item) => (
                <tr key={item.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 font-semibold text-[var(--foreground)]">{item.invoiceNumber}</td>
                  <td className="px-3 py-2">{formatDate(item.invoiceDate)}</td>
                  <td className="px-3 py-2">
                    <p>{item.customerName}</p>
                    <p className="text-xs text-[var(--muted)]">{item.customerMobile}</p>
                  </td>
                  <td className="px-3 py-2 font-semibold">{formatCurrency(item.total)}</td>
                  <td className="px-3 py-2">{item.paymentMethod}</td>
                  <td className="px-3 py-2">
                    <span
                      className={[
                        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                        paymentStatusBadge[item.paymentStatus],
                      ].join(" ")}
                    >
                      {item.paymentStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Link href={`/billing/invoices/${item.id}`} className="rounded-md border border-[var(--border)] px-2 py-1 text-xs font-semibold text-slate-700">
                        View Invoice
                      </Link>
                      <button
                        type="button"
                        onClick={() => window.open(`/billing/invoices/${item.id}`, "_blank")}
                        className="rounded-md border border-[var(--border)] px-2 py-1 text-xs font-semibold text-slate-700"
                      >
                        Print
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          window.open(
                            `https://wa.me/?text=${encodeURIComponent(`Invoice ${item.invoiceNumber} ${formatCurrency(item.total)}`)}`,
                            "_blank",
                          );
                        }}
                        className="rounded-md border border-[var(--border)] px-2 py-1 text-xs font-semibold text-slate-700"
                      >
                        WhatsApp
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {payload ? (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <p className="text-sm text-[var(--muted)]">Page {payload.pagination.page} of {payload.pagination.totalPages}</p>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(payload.pagination.totalPages, current + 1))}
            disabled={page >= payload.pagination.totalPages}
            className="h-9 rounded-lg border border-[var(--border)] px-3 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
