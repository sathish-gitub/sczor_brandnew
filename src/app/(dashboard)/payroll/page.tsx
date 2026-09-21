"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

type StaffOverviewItem = {
  id: string;
  name: string;
  designation: string;
  baseSalary: number | null;
  commissionRate: number | null;
  salaryConfigured: boolean;
  attendance: { PRESENT: number; ABSENT: number; LEAVE: number; HALF_DAY: number };
  payrollId: string | null;
  payrollStatus: string | null;
};

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export default function PayrollPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [items, setItems] = useState<StaffOverviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkSummary, setBulkSummary] = useState<{ generated: number; failed: Array<{ staffName: string; reason: string }> } | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/payroll/staff-overview?month=${month}&year=${year}`, { cache: "no-store" });
      const payload = (await response.json()) as { error?: string; items?: StaffOverviewItem[] };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load payroll overview.");
      }

      setItems(payload.items ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load payroll overview.");
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    setRowErrors({});
    setBulkSummary(null);
    load();
  }, [load]);

  async function generateForStaff(staffId: string, regenerate: boolean) {
    setPendingIds((prev) => new Set(prev).add(staffId));
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[staffId];
      return next;
    });

    try {
      const response = await fetch("/api/payroll/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, month, year, regenerate }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to generate payroll.");
      }

      await load();
    } catch (generateError) {
      setRowErrors((prev) => ({
        ...prev,
        [staffId]: generateError instanceof Error ? generateError.message : "Unable to generate payroll.",
      }));
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(staffId);
        return next;
      });
    }
  }

  async function generateAll() {
    const eligibleCount = items.filter((item) => item.salaryConfigured).length;

    if (eligibleCount === 0) {
      return;
    }

    const confirmed = window.confirm(
      `Generate payroll for ${eligibleCount} staff member${eligibleCount === 1 ? "" : "s"} for ${months[month - 1]} ${year}?`,
    );

    if (!confirmed) {
      return;
    }

    setBulkPending(true);
    setBulkSummary(null);

    try {
      const response = await fetch("/api/payroll/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year, generateForAll: true }),
      });
      const payload = (await response.json()) as {
        error?: string;
        generated?: Array<{ staffName: string }>;
        failed?: Array<{ staffName: string; reason: string }>;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to generate payroll.");
      }

      setBulkSummary({ generated: payload.generated?.length ?? 0, failed: payload.failed ?? [] });
      await load();
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Unable to generate payroll.");
    } finally {
      setBulkPending(false);
    }
  }

  const yearOptions = Array.from({ length: 5 }).map((_, index) => now.getFullYear() - 2 + index);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Payroll</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Staff salary configuration and monthly overview.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href="/payroll/history"
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
            >
              View Payroll History
            </Link>
            <Link
              href="/reports/payroll"
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
            >
              Payroll Reports
            </Link>
          </div>
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

          <button
            type="button"
            onClick={generateAll}
            disabled={bulkPending || loading}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {bulkPending ? "Generating..." : "Generate All"}
          </button>
        </div>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {bulkSummary ? (
        <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm">
          <p className="font-semibold text-emerald-700">Generated payroll for {bulkSummary.generated} staff member(s).</p>
          {bulkSummary.failed.length > 0 ? (
            <ul className="mt-2 space-y-1 text-amber-700">
              {bulkSummary.failed.map((failure) => (
                <li key={failure.staffName}>
                  {failure.staffName}: {failure.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-[var(--muted)]">No active staff found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-slate-50 text-xs uppercase tracking-[0.06em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3">Staff Name</th>
                  <th className="px-4 py-3">Designation</th>
                  <th className="px-4 py-3">Base Salary</th>
                  <th className="px-4 py-3">Commission Rate</th>
                  <th className="px-4 py-3">Attendance Summary</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                      <Link href={`/staff/${item.id}`} className="hover:underline">
                        {item.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{item.designation}</td>
                    {item.salaryConfigured ? (
                      <>
                        <td className="px-4 py-3 text-[var(--muted)]">{formatCurrency(item.baseSalary ?? 0)}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{item.commissionRate}%</td>
                      </>
                    ) : (
                      <td className="px-4 py-3 text-amber-700" colSpan={2}>
                        <Link
                          href={`/staff/${item.id}/edit`}
                          className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold hover:bg-amber-200"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Salary not configured
                        </Link>
                      </td>
                    )}
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {item.attendance.PRESENT} Present / {item.attendance.LEAVE} Leave / {item.attendance.ABSENT} Absent
                      {item.attendance.HALF_DAY > 0 ? ` / ${item.attendance.HALF_DAY} Half-day` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5">
                        {item.payrollId ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              Generated
                            </span>
                            <Link href={`/payroll/${item.payrollId}`} className="text-xs font-semibold text-[var(--primary)] hover:underline">
                              View Payslip
                            </Link>
                            <button
                              type="button"
                              disabled={pendingIds.has(item.id)}
                              onClick={() => {
                                if (window.confirm(`Regenerate payroll for ${item.name} for ${months[month - 1]} ${year}?`)) {
                                  generateForStaff(item.id, true);
                                }
                              }}
                              className="text-xs font-semibold text-slate-600 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {pendingIds.has(item.id) ? "Regenerating..." : "Regenerate"}
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">Not Generated</span>
                            <button
                              type="button"
                              disabled={!item.salaryConfigured || pendingIds.has(item.id)}
                              onClick={() => generateForStaff(item.id, false)}
                              title={item.salaryConfigured ? undefined : "Configure salary first"}
                              className="text-xs font-semibold text-[var(--primary)] hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
                            >
                              {pendingIds.has(item.id) ? "Generating..." : "Generate"}
                            </button>
                          </div>
                        )}
                        {rowErrors[item.id] ? <p className="text-xs text-red-600">{rowErrors[item.id]}</p> : null}
                      </div>
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
