"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CalendarClock } from "lucide-react";

import { Modal } from "@/components/ui/Modal";
import { PAYROLL_DAY_METHOD_INFO, type PayrollDayMethod } from "@/lib/payrollDayMethod";
import { formatMissingDatesSummary } from "@/lib/formatMissingDates";
import { formatISTDayMonth } from "@/lib/time";

type StaffOverviewItem = {
  id: string;
  name: string;
  designation: string;
  baseSalary: number | null;
  commissionRate: number | null;
  salaryConfigured: boolean;
  attendance: { PRESENT: number; ABSENT: number; LEAVE: number; HALF_DAY: number; WEEK_OFF: number };
  payrollId: string | null;
  payrollStatus: string | null;
  missingDates: string[];
};

type PayrollPreviewResult = {
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  weekOffDays: number;
  paidLeaveDays: number;
  lopDays: number;
  halfDays: number;
  usedDefaultLeaveAllowance: boolean;
  dayMethod: PayrollDayMethod;
  dailyRateDivisor: number;
  dailyRate: number;
  periodStart: string;
  periodEnd: string;
  payableDays: number;
  baseSalaryPaid: number;
  deductionDays: number;
  leaveDeduction: number;
  commissionAmount: number;
  netPay: number;
};

type SingleGenerateTarget = { staffId: string; staffName: string; regenerate: boolean };

type BulkPreviewItem = { staffId: string; staffName: string; result?: PayrollPreviewResult; error?: string; missingDates?: string[] };

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

  const [singleTarget, setSingleTarget] = useState<SingleGenerateTarget | null>(null);
  const [singlePreview, setSinglePreview] = useState<PayrollPreviewResult | null>(null);
  const [singleMissingDates, setSingleMissingDates] = useState<string[] | null>(null);
  const [singlePreviewLoading, setSinglePreviewLoading] = useState(false);
  const [singlePreviewError, setSinglePreviewError] = useState<string | null>(null);

  const [bulkPreviewOpen, setBulkPreviewOpen] = useState(false);
  const [bulkPreviewItems, setBulkPreviewItems] = useState<BulkPreviewItem[] | null>(null);
  const [bulkPreviewLoading, setBulkPreviewLoading] = useState(false);
  const [bulkPreviewError, setBulkPreviewError] = useState<string | null>(null);

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

  async function openSinglePreview(staffId: string, staffName: string, regenerate: boolean) {
    setSingleTarget({ staffId, staffName, regenerate });
    setSinglePreview(null);
    setSingleMissingDates(null);
    setSinglePreviewError(null);
    setSinglePreviewLoading(true);

    try {
      const response = await fetch("/api/payroll/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, month, year }),
      });
      const payload = (await response.json()) as { error?: string; result?: PayrollPreviewResult; missingDates?: string[] };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to calculate payroll preview.");
      }

      if (payload.missingDates && payload.missingDates.length > 0) {
        setSingleMissingDates(payload.missingDates);
      } else {
        setSinglePreview(payload.result ?? null);
      }
    } catch (previewError) {
      setSinglePreviewError(previewError instanceof Error ? previewError.message : "Unable to calculate payroll preview.");
    } finally {
      setSinglePreviewLoading(false);
    }
  }

  function closeSinglePreview() {
    setSingleTarget(null);
    setSinglePreview(null);
    setSingleMissingDates(null);
    setSinglePreviewError(null);
    setSinglePreviewLoading(false);
  }

  async function confirmSingleGenerate() {
    if (!singleTarget) {
      return;
    }

    await generateForStaff(singleTarget.staffId, singleTarget.regenerate);
    closeSinglePreview();
  }

  async function openBulkPreview() {
    const eligibleCount = items.filter((item) => item.salaryConfigured).length;

    if (eligibleCount === 0) {
      return;
    }

    setBulkPreviewOpen(true);
    setBulkPreviewItems(null);
    setBulkPreviewError(null);
    setBulkPreviewLoading(true);

    try {
      const response = await fetch("/api/payroll/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year, generateForAll: true }),
      });
      const payload = (await response.json()) as { error?: string; previews?: BulkPreviewItem[] };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to calculate payroll preview.");
      }

      setBulkPreviewItems(payload.previews ?? []);
    } catch (previewError) {
      setBulkPreviewError(previewError instanceof Error ? previewError.message : "Unable to calculate payroll preview.");
    } finally {
      setBulkPreviewLoading(false);
    }
  }

  function closeBulkPreview() {
    setBulkPreviewOpen(false);
    setBulkPreviewItems(null);
    setBulkPreviewError(null);
    setBulkPreviewLoading(false);
  }

  async function confirmBulkGenerate() {
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
      closeBulkPreview();
      await load();
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Unable to generate payroll.");
    } finally {
      setBulkPending(false);
    }
  }

  const yearOptions = Array.from({ length: 5 }).map((_, index) => now.getFullYear() - 2 + index);

  const bulkHasMissingAttendance = (bulkPreviewItems ?? []).some((entry) => (entry.missingDates?.length ?? 0) > 0);

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
            onClick={openBulkPreview}
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
                      <div>
                        {item.attendance.PRESENT} Present / {item.attendance.LEAVE} Leave / {item.attendance.ABSENT} Absent
                        {item.attendance.HALF_DAY > 0 ? ` / ${item.attendance.HALF_DAY} Half-day` : ""}
                        {item.attendance.WEEK_OFF > 0 ? ` / ${item.attendance.WEEK_OFF} Week Off` : ""}
                      </div>
                      {item.missingDates.length > 0 ? (
                        <Link
                          href={`/attendance?staffId=${item.id}&date=${item.missingDates[0]}`}
                          title={formatMissingDatesSummary(item.missingDates)}
                          className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-200"
                        >
                          <CalendarClock className="h-3.5 w-3.5" />
                          Attendance incomplete ({item.missingDates.length} days)
                        </Link>
                      ) : null}
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
                              onClick={() => openSinglePreview(item.id, item.name, true)}
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
                              onClick={() => openSinglePreview(item.id, item.name, false)}
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

      <Modal
        open={singleTarget !== null}
        onClose={closeSinglePreview}
        title={singleMissingDates && singleMissingDates.length > 0 ? "Attendance Incomplete" : "Confirm Payslip Generation"}
        size="sm"
      >
        {singleTarget ? (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {singleTarget.staffName} - {months[month - 1]} {year}
            </p>

            {singlePreviewLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-8 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : singlePreviewError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {singlePreviewError}
              </div>
            ) : singleMissingDates && singleMissingDates.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    Attendance is incomplete for {singleTarget.staffName}. Please mark attendance for these dates before
                    generating payroll: <span className="font-semibold">{formatMissingDatesSummary(singleMissingDates)}</span>.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeSinglePreview}
                    className="h-10 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700"
                  >
                    Close
                  </button>
                  <Link
                    href={`/attendance?staffId=${singleTarget.staffId}&date=${singleMissingDates[0]}`}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white"
                  >
                    Go to Attendance
                  </Link>
                </div>
              </div>
            ) : singlePreview ? (
              <>
                <div className="space-y-1.5 rounded-xl border border-[var(--border)] bg-slate-50 px-3 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Pay Period</span>
                    <span className="font-medium text-[var(--foreground)]">
                      {formatISTDayMonth(singlePreview.periodStart)} - {formatISTDayMonth(singlePreview.periodEnd)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Present</span>
                    <span className="font-medium text-[var(--foreground)]">{singlePreview.presentDays} days</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Absent</span>
                    <span className="font-medium text-[var(--foreground)]">{singlePreview.absentDays} days</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Leave (paid)</span>
                    <span className="font-medium text-[var(--foreground)]">
                      {singlePreview.paidLeaveDays} days
                      {singlePreview.usedDefaultLeaveAllowance ? (
                        <span className="ml-1 font-normal text-[var(--muted)]">(salon default)</span>
                      ) : null}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Leave (unpaid/LOP)</span>
                    <span className="font-medium text-[var(--foreground)]">{singlePreview.lopDays} days</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Half Days</span>
                    <span className="font-medium text-[var(--foreground)]">{singlePreview.halfDays} days</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Week Off (paid)</span>
                    <span className="font-medium text-[var(--foreground)]">{singlePreview.weekOffDays} days</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Daily Rate Method</span>
                    <span className="font-medium text-[var(--foreground)]">
                      {PAYROLL_DAY_METHOD_INFO[singlePreview.dayMethod].label} (salary / {singlePreview.dailyRateDivisor} = {formatCurrency(singlePreview.dailyRate)}/day)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Payable Days</span>
                    <span className="font-medium text-[var(--foreground)]">
                      {singlePreview.payableDays} of {singlePreview.dailyRateDivisor}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Base Pay (prorated)</span>
                    <span className="font-medium text-[var(--foreground)]">{formatCurrency(singlePreview.baseSalaryPaid)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Commission</span>
                    <span className="font-medium text-[var(--foreground)]">{formatCurrency(singlePreview.commissionAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-red-600">
                    <span>Deduction ({singlePreview.deductionDays} days)</span>
                    <span className="font-medium">-{formatCurrency(singlePreview.leaveDeduction)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-[var(--border)] pt-2 font-semibold text-[var(--foreground)]">
                    <span>Estimated Net Pay</span>
                    <span>{formatCurrency(singlePreview.netPay)}</span>
                  </div>
                </div>

                <p className="text-xs text-[var(--muted)]">
                  If this doesn&apos;t look right, cancel and update attendance records first, then come back to generate.
                </p>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeSinglePreview}
                    className="h-10 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmSingleGenerate}
                    disabled={!singlePreview || pendingIds.has(singleTarget.staffId)}
                    className="h-10 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pendingIds.has(singleTarget.staffId) ? "Generating..." : "Confirm & Generate"}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal open={bulkPreviewOpen} onClose={closeBulkPreview} title="Confirm Bulk Payslip Generation" size="lg">
        <div className="space-y-4">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {months[month - 1]} {year}
          </p>

          {bulkPreviewLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-8 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : bulkPreviewError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{bulkPreviewError}</div>
          ) : bulkPreviewItems ? (
            <div className="max-h-80 overflow-y-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--border)] bg-slate-50 text-xs uppercase tracking-[0.06em] text-[var(--muted)]">
                  <tr>
                    <th className="px-3 py-2">Staff</th>
                    <th className="px-3 py-2">Leave (paid/LOP)</th>
                    <th className="px-3 py-2">Payable Days</th>
                    <th className="px-3 py-2">Estimated Net Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkPreviewItems.map((entry) => (
                    <tr key={entry.staffId} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="px-3 py-2 font-medium text-[var(--foreground)]">{entry.staffName}</td>
                      {entry.missingDates && entry.missingDates.length > 0 ? (
                        <td className="px-3 py-2 text-red-700" colSpan={3}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 font-semibold">
                              <CalendarClock className="h-3.5 w-3.5" />
                              Attendance incomplete: {formatMissingDatesSummary(entry.missingDates)}
                            </span>
                            <Link
                              href={`/attendance?staffId=${entry.staffId}&date=${entry.missingDates[0]}`}
                              className="text-xs font-semibold text-[var(--primary)] hover:underline"
                            >
                              Go to Attendance
                            </Link>
                          </div>
                        </td>
                      ) : entry.result ? (
                        <>
                          <td className="px-3 py-2 text-[var(--muted)]">
                            {entry.result.paidLeaveDays} / {entry.result.lopDays}
                            {entry.result.usedDefaultLeaveAllowance ? (
                              <span className="ml-1 text-xs">(salon default)</span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-[var(--muted)]">
                            {entry.result.payableDays} of {entry.result.dailyRateDivisor}
                          </td>
                          <td className="px-3 py-2 font-medium text-[var(--foreground)]">
                            {formatCurrency(entry.result.netPay)}
                          </td>
                        </>
                      ) : (
                        <td className="px-3 py-2 text-amber-700" colSpan={3}>
                          {entry.error}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {bulkHasMissingAttendance ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Attendance is incomplete for one or more staff members. Mark their attendance for the dates listed above, then
              reopen Generate All.
            </div>
          ) : (
            <p className="text-xs text-[var(--muted)]">
              If this doesn&apos;t look right, cancel and update attendance records first, then come back to generate.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeBulkPreview}
              className="h-10 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmBulkGenerate}
              disabled={bulkPending || !bulkPreviewItems || bulkHasMissingAttendance}
              className="h-10 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {bulkPending ? "Generating..." : "Confirm & Generate"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
