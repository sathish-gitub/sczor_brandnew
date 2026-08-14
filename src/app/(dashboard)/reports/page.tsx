"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { RevenueChart } from "@/components/reports/RevenueChart";
import { StatCard } from "@/components/reports/StatCard";

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function thisWeekRange() {
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  return { startDate: toDateString(start), endDate: toDateString(end) };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export default function ReportsOverviewPage() {
  const [range, setRange] = useState(thisWeekRange());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [totals, setTotals] = useState({
    todayRevenue: 0,
    weekRevenue: 0,
    monthRevenue: 0,
    yearRevenue: 0,
  });

  const [daily, setDaily] = useState<Array<{ date: string; revenue: number }>>([]);
  const [services, setServices] = useState<Array<{ service: string; count: number; revenue: number; sharePercent: number }>>([]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        startDate: range.startDate,
        endDate: range.endDate,
      });

      const [overviewResp, servicesResp] = await Promise.all([
        fetch(`/api/reports/revenue?${params.toString()}`, { cache: "no-store" }),
        fetch(`/api/reports/services?${params.toString()}`, { cache: "no-store" }),
      ]);

      const overviewPayload = (await overviewResp.json().catch(() => null)) as
        | {
            error?: string;
            totals?: { grossRevenue: number };
            daily?: Array<{ date: string; revenue: number }>;
          }
        | null;
      const servicesPayload = (await servicesResp.json().catch(() => null)) as
        | { error?: string; items?: Array<{ service: string; count: number; revenue: number; sharePercent: number }> }
        | null;

      if (!active) {
        return;
      }

      if (!overviewResp.ok || !servicesResp.ok) {
        setError(overviewPayload?.error ?? servicesPayload?.error ?? "Unable to load reports.");
        setLoading(false);
        return;
      }

      const gross = overviewPayload?.totals?.grossRevenue ?? 0;
      setTotals({
        todayRevenue: dailyRevenueFor(0, overviewPayload?.daily ?? []),
        weekRevenue: gross,
        monthRevenue: gross,
        yearRevenue: gross,
      });
      setDaily((overviewPayload?.daily ?? []).map((item) => ({ date: item.date, revenue: item.revenue })));
      setServices(servicesPayload?.items ?? []);
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [range.startDate, range.endDate]);

  const chartData = useMemo(() => daily.map((item) => ({ label: item.date.slice(5), value: item.revenue })), [daily]);

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <header className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Reports & Analytics</h1>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </header>

      {loading ? (
        <div className="h-72 animate-pulse rounded-xl border border-[var(--border)] bg-white" />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Today's Revenue" value={formatCurrency(totals.todayRevenue)} />
            <StatCard label="This Week's Revenue" value={formatCurrency(totals.weekRevenue)} />
            <StatCard label="This Month's Revenue" value={formatCurrency(totals.monthRevenue)} />
            <StatCard label="This Year's Revenue" value={formatCurrency(totals.yearRevenue)} />
          </section>

          <RevenueChart title="Daily Revenue" data={chartData} />

          <section className="rounded-xl border border-[var(--border)] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--foreground)]">Top Services</h2>
              <Link href="/reports/revenue" className="text-xs font-semibold text-[var(--primary)]">View detailed revenue report</Link>
            </div>

            {services.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No service revenue data in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[640px] w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                    <tr>
                      <th className="py-2">Service</th>
                      <th className="py-2">Count</th>
                      <th className="py-2">Revenue</th>
                      <th className="py-2">% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((row) => (
                      <tr key={row.service} className="border-t border-[var(--border)]">
                        <td className="py-2 font-semibold">{row.service}</td>
                        <td className="py-2">{row.count}</td>
                        <td className="py-2">{formatCurrency(row.revenue)}</td>
                        <td className="py-2">{row.sharePercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function dailyRevenueFor(daysAgo: number, rows: Array<{ date: string; revenue: number }>) {
  const target = new Date();
  target.setDate(target.getDate() - daysAgo);
  const key = toDateString(target);
  return rows.find((row) => row.date === key)?.revenue ?? 0;
}
