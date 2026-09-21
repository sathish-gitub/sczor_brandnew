"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type HistoryItem = {
  id: string;
  staffId: string;
  staffName: string;
  month: number;
  year: number;
  netPay: number;
  payslipNumber: string;
  generatedAt: string;
};

type StaffOption = { id: string; name: string };

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export default function PayrollHistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [staffFilter, setStaffFilter] = useState("ALL");
  const [yearFilter, setYearFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (staffFilter !== "ALL") params.set("staffId", staffFilter);
      if (yearFilter !== "ALL") params.set("year", yearFilter);

      try {
        const response = await fetch(`/api/payroll/history?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as { error?: string; items?: HistoryItem[]; staffOptions?: StaffOption[] };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load payroll history.");
        }

        if (!active) {
          return;
        }

        setItems(payload.items ?? []);
        setStaffOptions(payload.staffOptions ?? []);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load payroll history.");
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
  }, [staffFilter, yearFilter]);

  const yearOptions = Array.from(new Set(items.map((item) => item.year))).sort((a, b) => b - a);
  const now = new Date();
  const fallbackYearOptions = Array.from({ length: 5 }).map((_, index) => now.getFullYear() - 2 + index);
  const availableYears = yearOptions.length > 0 ? yearOptions : fallbackYearOptions;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Payroll History</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">All generated payslips across every month and staff member.</p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={staffFilter}
            onChange={(event) => setStaffFilter(event.target.value)}
            className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm"
          >
            <option value="ALL">All Staff</option>
            {staffOptions.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.name}
              </option>
            ))}
          </select>
          <select
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value)}
            className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm"
          >
            <option value="ALL">All Years</option>
            {availableYears.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <Link
            href="/payroll"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700"
          >
            Back to Payroll
          </Link>
        </div>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-[var(--muted)]">No payroll records found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-slate-50 text-xs uppercase tracking-[0.06em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3">Staff Name</th>
                  <th className="px-4 py-3">Month/Year</th>
                  <th className="px-4 py-3">Net Pay</th>
                  <th className="px-4 py-3">Payslip Number</th>
                  <th className="px-4 py-3">Generated Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-4 py-3 font-medium text-[var(--foreground)]">{item.staffName}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {months[item.month - 1]} {item.year}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[var(--foreground)]">{formatCurrency(item.netPay)}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{item.payslipNumber}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{formatDate(item.generatedAt)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/payroll/${item.id}`} className="text-xs font-semibold text-[var(--primary)] hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
