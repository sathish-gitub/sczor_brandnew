"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { StatCard } from "@/components/reports/StatCard";
import { PayrollTrendChart, type PayrollTrendPoint } from "@/components/charts/PayrollTrendChart";
import { CommissionVsBaseBarChart, type CommissionVsBasePoint } from "@/components/charts/CommissionVsBaseBarChart";

type StaffBreakdownRow = {
  payrollId: string;
  staffId: string;
  staffName: string;
  baseSalary: number;
  commission: number;
  deduction: number;
  netPay: number;
};

type PayrollReportPayload = {
  summary: {
    totalStaffPaid: number;
    totalBaseSalary: number;
    totalCommission: number;
    totalDeductions: number;
    totalNetPay: number;
  };
  payrollTrend: PayrollTrendPoint[];
  staffBreakdown: StaffBreakdownRow[];
  commissionVsBase: CommissionVsBasePoint[];
  unpaidStaff: Array<{ staffId: string; staffName: string; reason: string }>;
};

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export default function PayrollReportsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<PayrollReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/reports/payroll?month=${month}&year=${year}`, { cache: "no-store" });
        const payload = (await response.json()) as PayrollReportPayload & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load payroll report.");
        }

        if (!active) {
          return;
        }

        setData(payload);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load payroll report.");
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
  }, [month, year]);

  const yearOptions = Array.from({ length: 5 }).map((_, index) => now.getFullYear() - 2 + index);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Payroll Reports</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Monthly payroll cost, trends, and per-staff breakdown.</p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(event) => setMonth(Number(event.target.value))}
            className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm"
          >
            {months.map((label, index) => (
              <option key={label} value={index + 1}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm"
          >
            {yearOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Staff Paid" value={data?.summary.totalStaffPaid ?? 0} />
        <StatCard label="Total Base Salary" value={formatCurrency(data?.summary.totalBaseSalary ?? 0)} />
        <StatCard label="Total Commission" value={formatCurrency(data?.summary.totalCommission ?? 0)} />
        <StatCard label="Total Net Pay" value={formatCurrency(data?.summary.totalNetPay ?? 0)} />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <PayrollTrendChart data={data?.payrollTrend ?? []} loading={loading} />
        <CommissionVsBaseBarChart data={data?.commissionVsBase ?? []} loading={loading} />
      </div>

      <section className="rounded-xl border border-[var(--border)] bg-white p-4">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-[var(--foreground)]">Staff Breakdown</h2>
          <p className="text-xs text-[var(--muted)]">Generated payslips for {months[month - 1]} {year}, sorted by net pay.</p>
        </div>

        {loading ? (
          <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
        ) : (data?.staffBreakdown ?? []).length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No payroll generated for this month yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                <tr>
                  <th className="py-2">Name</th>
                  <th className="py-2">Base</th>
                  <th className="py-2">Commission</th>
                  <th className="py-2">Deduction</th>
                  <th className="py-2">Net Pay</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {(data?.staffBreakdown ?? []).map((row) => (
                  <tr key={row.staffId} className="border-t border-[var(--border)]">
                    <td className="py-2 font-semibold">{row.staffName}</td>
                    <td className="py-2">{formatCurrency(row.baseSalary)}</td>
                    <td className="py-2">{formatCurrency(row.commission)}</td>
                    <td className="py-2 text-red-600">-{formatCurrency(row.deduction)}</td>
                    <td className="py-2 font-semibold">{formatCurrency(row.netPay)}</td>
                    <td className="py-2">
                      <Link href={`/payroll/${row.payrollId}`} className="text-xs font-semibold text-[var(--primary)]">
                        View Payslip
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h2 className="text-base font-semibold text-[var(--foreground)]">Not Yet Processed</h2>
        </div>

        {loading ? (
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
        ) : (data?.unpaidStaff ?? []).length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Everyone with a configured salary has been processed for this month.</p>
        ) : (
          <div className="space-y-2">
            {(data?.unpaidStaff ?? []).map((row) => (
              <div
                key={row.staffId}
                className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{row.staffName}</p>
                  <p className="text-xs text-amber-700">{row.reason}</p>
                </div>
                <Link href="/payroll" className="text-xs font-semibold text-[var(--primary)] hover:underline">
                  Generate Now
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
