"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

export default function InvoicesPage() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState("ALL");
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
        status,
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
  }, [page, status, query, fromDate, toDate]);

  function exportCsv() {
    if (!payload || payload.items.length === 0) {
      return;
    }

    const headers = [
      "Invoice#",
      "Date",
      "Customer",
      "Items",
      "Subtotal",
      "GST",
      "Discount",
      "Loyalty Discount",
      "Total",
      "Payment",
      "Status",
    ];

    const rows = payload.items.map((item) => [
      item.invoiceNumber,
      formatDate(item.invoiceDate),
      item.customerName,
      String(item.itemsCount),
      String(item.subtotal),
      String(item.gst),
      String(item.discount),
      String(item.loyaltyDiscount),
      String(item.total),
      item.paymentMethod,
      item.paymentStatus,
    ]);

    const csvText = [headers, ...rows]
      .map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const href = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "invoices.csv";
    anchor.click();

    URL.revokeObjectURL(href);
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

        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700"
        >
          Export CSV
        </button>
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
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm"
          >
            <option value="ALL">All Statuses</option>
            <option value="PAID">PAID</option>
            <option value="PENDING">PENDING</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="REFUNDED">REFUNDED</option>
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
          <table className="min-w-[1280px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">Invoice#</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Items</th>
                <th className="px-3 py-2">Subtotal</th>
                <th className="px-3 py-2">GST</th>
                <th className="px-3 py-2">Discount</th>
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
                  <td className="px-3 py-2">{item.itemsCount}</td>
                  <td className="px-3 py-2">{formatCurrency(item.subtotal)}</td>
                  <td className="px-3 py-2">{formatCurrency(item.gst)}</td>
                  <td className="px-3 py-2">-{formatCurrency(item.discount + item.loyaltyDiscount)}</td>
                  <td className="px-3 py-2 font-semibold">{formatCurrency(item.total)}</td>
                  <td className="px-3 py-2">{item.paymentMethod}</td>
                  <td className="px-3 py-2">{item.paymentStatus}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Link href={`/billing/invoices/${item.id}`} className="rounded-md border border-[var(--border)] px-2 py-1 text-xs font-semibold text-slate-700">
                        View
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
