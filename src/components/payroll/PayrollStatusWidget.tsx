"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Wallet } from "lucide-react";

type PayrollStatus = {
  month: number;
  year: number;
  totalConfigured: number;
  totalProcessed: number;
  unprocessedCount: number;
  totalNetPay: number;
  dayOfMonth: number;
};

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export function PayrollStatusWidget() {
  const [status, setStatus] = useState<PayrollStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      const response = await fetch("/api/dashboard/payroll-status", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as PayrollStatus | null;

      if (!active || !response.ok) {
        setLoading(false);
        return;
      }

      setStatus(payload);
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const monthLabel = status ? months[status.month - 1] : "";
  const showReminder = !!status && status.unprocessedCount > 0 && status.dayOfMonth >= 25;
  const allCaughtUp = !!status && (status.unprocessedCount === 0 || status.dayOfMonth < 25);

  return (
    <section className="rounded-xl border border-[var(--border)] bg-white">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
        <h2 className="text-base font-semibold text-[var(--foreground)]">Payroll Status</h2>
        <Link href="/payroll" className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--primary)]">
          Go to Payroll
        </Link>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
        ) : !status || status.totalConfigured === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <Wallet className="h-8 w-8 text-slate-400" />
            <p className="text-sm font-medium text-[var(--foreground)]">No staff have salaries configured yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {status.totalProcessed} of {status.totalConfigured} staff processed
              </p>
              <p className="text-xs text-[var(--muted)]">
                Total net pay so far for {monthLabel}: {formatCurrency(status.totalNetPay)}
              </p>
            </div>

            {showReminder ? (
              <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  {status.unprocessedCount} staff member{status.unprocessedCount === 1 ? "" : "s"} still need payroll processed
                  for {monthLabel}
                </span>
              </div>
            ) : null}

            {allCaughtUp && !showReminder ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>All caught up for {monthLabel} ✅</span>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
