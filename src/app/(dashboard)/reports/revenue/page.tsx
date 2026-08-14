"use client";

import { useEffect, useMemo, useState } from "react";

import { DataTable } from "@/components/reports/DataTable";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { StatCard } from "@/components/reports/StatCard";

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  return { startDate: toDateString(start), endDate: toDateString(now) };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

type Payload = {
  totals: {
    grossRevenue: number;
    gstCollected: number;
    discountsGiven: number;
    loyaltyDiscounts: number;
    netRevenue: number;
  };
  byPaymentMethod: Array<{ method: string; amount: number; count: number }>;
  daily: Array<{ date: string; revenue: number; gst: number; discount: number; net: number; invoices: number }>;
};

export default function RevenueReportPage() {
  const [range, setRange] = useState(monthRange());
  const [paymentMethod, setPaymentMethod] = useState("ALL");
  const [staffId, setStaffId] = useState("ALL");
  const [staffOptions, setStaffOptions] = useState<Array<{ id: string; name: string }>>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<Payload | null>(null);

  useEffect(() => {
    let active = true;
    async function loadStaff() {
      const response = await fetch("/api/staff", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as { items?: Array<{ id: string; name: string }> } | null;
      if (active) {
        setStaffOptions(data?.items ?? []);
      }
    }
    loadStaff();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadReport() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        startDate: range.startDate,
        endDate: range.endDate,
      });

      if (paymentMethod !== "ALL") {
        params.set("paymentMethod", paymentMethod);
      }

      if (staffId !== "ALL") {
        params.set("staffId", staffId);
      }

      const response = await fetch(`/api/reports/revenue?${params.toString()}`, { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as (Payload & { error?: string }) | null;

      if (!active) {
        return;
      }

      if (!response.ok || !data) {
        setError(data?.error ?? "Unable to load revenue report.");
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
  }, [range.startDate, range.endDate, paymentMethod, staffId]);

  const paymentMax = useMemo(() => Math.max(1, ...(payload?.byPaymentMethod.map((item) => item.amount) ?? [0])), [payload]);

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <header className="rounded-xl border border-[var(--border)] bg-white p-4">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Revenue Report</h1>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <DateRangePicker value={range} onChange={setRange} />
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm">
            <option value="ALL">All Payments</option>
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="CARD">Card</option>
            <option value="WALLET">Wallet</option>
          </select>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm">
            <option value="ALL">All Staff</option>
            {staffOptions.map((staff) => (
              <option key={staff.id} value={staff.id}>{staff.name}</option>
            ))}
          </select>
        </div>
      </header>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl border border-[var(--border)] bg-white" />
      ) : payload ? (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard label="Gross Revenue" value={formatCurrency(payload.totals.grossRevenue)} />
            <StatCard label="GST Collected" value={formatCurrency(payload.totals.gstCollected)} />
            <StatCard label="Discounts Given" value={formatCurrency(payload.totals.discountsGiven)} />
            <StatCard label="Loyalty Discounts" value={formatCurrency(payload.totals.loyaltyDiscounts)} />
            <StatCard label="Net Revenue" value={formatCurrency(payload.totals.netRevenue)} />
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-white p-4">
            <h2 className="text-base font-semibold">Revenue by Payment Method</h2>
            <div className="mt-3 space-y-2">
              {payload.byPaymentMethod.map((item) => {
                const width = Math.round((item.amount / paymentMax) * 100);
                return (
                  <div key={item.method}>
                    <p className="mb-1 text-xs font-semibold text-[var(--muted)]">{item.method}: {formatCurrency(item.amount)}</p>
                    <div className="h-6 rounded-lg bg-slate-100">
                      <div className="h-6 rounded-lg bg-blue-500" style={{ width: `${Math.max(width, 3)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <DataTable
            columns={[
              { key: "date", label: "Date", sortable: true, render: (row) => row.date, sortValue: (row) => row.date },
              { key: "revenue", label: "Revenue", sortable: true, render: (row) => formatCurrency(row.revenue), sortValue: (row) => row.revenue },
              { key: "gst", label: "GST", sortable: true, render: (row) => formatCurrency(row.gst), sortValue: (row) => row.gst },
              { key: "discount", label: "Discount", sortable: true, render: (row) => formatCurrency(row.discount), sortValue: (row) => row.discount },
              { key: "net", label: "Net", sortable: true, render: (row) => formatCurrency(row.net), sortValue: (row) => row.net },
              { key: "invoices", label: "Invoices", sortable: true, render: (row) => row.invoices, sortValue: (row) => row.invoices },
            ]}
            rows={payload.daily}
            csvFileName="revenue-daily.csv"
            emptyText="No daily revenue data found."
          />
        </>
      ) : null}
    </div>
  );
}
