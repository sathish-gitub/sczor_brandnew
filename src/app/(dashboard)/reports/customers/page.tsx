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
  overview: {
    totalCustomers: number;
    newThisMonth: number;
    returningCustomers: number;
    averageSpendPerVisit: number;
    newVsReturning: {
      newCount: number;
      returningCount: number;
    };
  };
  topCustomers: Array<{
    customerId: string;
    name: string;
    mobile: string;
    visits: number;
    totalSpent: number;
    tier: string;
    lastVisit: string | null;
  }>;
  acquisition: Array<{
    month: string;
    newCustomers: number;
    returning: number;
    totalVisits: number;
  }>;
};

type TopCustomerRow = Payload["topCustomers"][number] & {
  rank: number;
};

type AcquisitionRow = Payload["acquisition"][number];

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export default function CustomerReportPage() {
  const [range, setRange] = useState(monthRange());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<Payload | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        startDate: range.startDate,
        endDate: range.endDate,
      });

      const response = await fetch(`/api/reports/customers?${params.toString()}`, { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as (Payload & { error?: string }) | null;

      if (!active) {
        return;
      }

      if (!response.ok || !data) {
        setError(data?.error ?? "Unable to load customer analytics.");
        setLoading(false);
        return;
      }

      setPayload(data);
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [range.startDate, range.endDate]);

  const donut = useMemo(() => {
    const total = (payload?.overview.newVsReturning.newCount ?? 0) + (payload?.overview.newVsReturning.returningCount ?? 0);
    if (total === 0) {
      return { newPercent: 0, returningPercent: 0 };
    }

    const newPercent = Math.round(((payload?.overview.newVsReturning.newCount ?? 0) / total) * 100);
    return { newPercent, returningPercent: 100 - newPercent };
  }, [payload]);

  const topRows = useMemo<TopCustomerRow[]>(() => {
    if (!payload) {
      return [];
    }

    return payload.topCustomers.map((customer, index) => ({
      ...customer,
      rank: index + 1,
    }));
  }, [payload]);

  const acquisitionRows = useMemo<AcquisitionRow[]>(() => payload?.acquisition ?? [], [payload]);

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <header className="rounded-xl border border-[var(--border)] bg-white p-4">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Customer Analytics</h1>
        <div className="mt-3">
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </header>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl border border-[var(--border)] bg-white" />
      ) : payload ? (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Total Customers" value={payload.overview.totalCustomers} />
            <StatCard label="New This Month" value={payload.overview.newThisMonth} />
            <StatCard label="Returning Customers" value={payload.overview.returningCustomers} />
            <StatCard label="Avg Spend per Visit" value={formatCurrency(payload.overview.averageSpendPerVisit)} />
          </section>

          <section className="grid gap-3 lg:grid-cols-[300px_1fr]">
            <article className="rounded-xl border border-[var(--border)] bg-white p-4">
              <h2 className="text-base font-semibold">New vs Returning</h2>
              <div className="mt-4 flex items-center justify-center">
                <div
                  className="h-40 w-40 rounded-full"
                  style={{
                    background: `conic-gradient(#3b82f6 0% ${donut.newPercent}%, #22c55e ${donut.newPercent}% 100%)`,
                  }}
                >
                  <div className="m-6 flex h-28 w-28 items-center justify-center rounded-full bg-white text-xs font-semibold text-[var(--muted)]">
                    Split
                  </div>
                </div>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">New: {donut.newPercent}% | Returning: {donut.returningPercent}%</p>
            </article>

            <DataTable<TopCustomerRow>
              columns={[
                { key: "rank", label: "Rank", sortable: true, render: (row) => row.rank, sortValue: (row) => row.rank },
                { key: "name", label: "Customer", sortable: true, render: (row) => row.name, sortValue: (row) => row.name },
                { key: "visits", label: "Visits", sortable: true, render: (row) => row.visits, sortValue: (row) => row.visits },
                { key: "spent", label: "Total Spent", sortable: true, render: (row) => formatCurrency(row.totalSpent), sortValue: (row) => row.totalSpent },
                { key: "tier", label: "Loyalty Tier", sortable: true, render: (row) => row.tier, sortValue: (row) => row.tier },
                { key: "last", label: "Last Visit", sortable: true, render: (row) => formatDate(row.lastVisit), sortValue: (row) => row.lastVisit ?? "" },
              ]}
              rows={topRows}
              csvFileName="top-customers.csv"
              emptyText="No top customers in this period."
            />
          </section>

          <DataTable<AcquisitionRow>
            columns={[
              { key: "month", label: "Month", sortable: true, render: (row) => row.month, sortValue: (row) => row.month },
              { key: "new", label: "New Customers", sortable: true, render: (row) => row.newCustomers, sortValue: (row) => row.newCustomers },
              { key: "ret", label: "Returning", sortable: true, render: (row) => row.returning, sortValue: (row) => row.returning },
              { key: "total", label: "Total Visits", sortable: true, render: (row) => row.totalVisits, sortValue: (row) => row.totalVisits },
            ]}
            rows={acquisitionRows}
            csvFileName="customer-acquisition.csv"
            emptyText="No acquisition data available."
          />
        </>
      ) : null}
    </div>
  );
}
