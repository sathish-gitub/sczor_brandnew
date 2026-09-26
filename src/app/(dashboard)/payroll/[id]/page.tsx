"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type PayrollDetail = {
  id: string;
  payslipNumber: string;
  month: number;
  year: number;
  status: string;
  generatedAt: string;
  staffName: string;
  designation: string;
  baseSalary: number;
  commissionRate: number;
  commissionAmount: number;
  revenueGenerated: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  halfDays: number;
  paidLeaveDays: number;
  lopDays: number;
  totalWorkingDays: number;
  leaveDeduction: number;
  grossPay: number;
  netPay: number;
};

type TenantDetail = {
  name: string;
  logo: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
};

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}

export default function PayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const [payroll, setPayroll] = useState<PayrollDetail | null>(null);
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const { id } = await params;
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/payroll/${id}`, { cache: "no-store" });
        const payload = (await response.json()) as { error?: string; payroll?: PayrollDetail; tenant?: TenantDetail };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load payslip.");
        }

        if (!active) {
          return;
        }

        setPayroll(payload.payroll ?? null);
        setTenant(payload.tenant ?? null);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load payslip.");
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
  }, [params]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-10 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (error || !payroll || !tenant) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error ?? "Payslip not found."}
      </div>
    );
  }

  const locationLine = [[tenant.city, tenant.state].filter(Boolean).join(", "), tenant.pincode]
    .filter(Boolean)
    .join(" - ");
  const contactLine = [tenant.phone, tenant.email].filter(Boolean).join(" | ");

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white"
        >
          Print
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700"
        >
          Download PDF
        </button>
        <Link
          href="/payroll"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700"
        >
          Back to Payroll
        </Link>
      </div>

      <div className="mx-auto max-w-2xl rounded-2xl border border-[var(--border)] bg-white p-8 print:border-none print:p-0 print:shadow-none">
        <div className="flex items-start justify-between border-b border-dashed border-[var(--border)] pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">{tenant.name}</h1>
            {tenant.address ? <p className="text-sm text-[var(--muted)]">{tenant.address}</p> : null}
            {locationLine ? <p className="text-sm text-[var(--muted)]">{locationLine}</p> : null}
            {contactLine ? <p className="text-sm text-[var(--muted)]">{contactLine}</p> : null}
          </div>
          <div className="text-right">
            <p className="text-lg font-bold tracking-widest text-[var(--foreground)]">PAYSLIP</p>
            <p className="text-sm text-[var(--muted)]">{months[payroll.month - 1]} {payroll.year}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-b border-dashed border-[var(--border)] py-4 text-sm">
          <div>
            <p className="text-[var(--muted)]">Payslip No</p>
            <p className="font-semibold text-[var(--foreground)]">{payroll.payslipNumber}</p>
          </div>
          <div>
            <p className="text-[var(--muted)]">Pay Period</p>
            <p className="font-semibold text-[var(--foreground)]">{months[payroll.month - 1]} {payroll.year}</p>
          </div>
          <div>
            <p className="text-[var(--muted)]">Employee</p>
            <p className="font-semibold text-[var(--foreground)]">{payroll.staffName}</p>
          </div>
          <div>
            <p className="text-[var(--muted)]">Designation</p>
            <p className="font-semibold text-[var(--foreground)]">{payroll.designation}</p>
          </div>
        </div>

        <div className="border-b border-dashed border-[var(--border)] py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Earnings</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--foreground)]">Base Salary</span>
              <span className="font-medium text-[var(--foreground)]">{formatCurrency(payroll.baseSalary)}</span>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--foreground)]">Commission ({payroll.commissionRate}%)</span>
                <span className="font-medium text-[var(--foreground)]">{formatCurrency(payroll.commissionAmount)}</span>
              </div>
              <p className="text-xs text-[var(--muted)]">(on {formatCurrency(payroll.revenueGenerated)} revenue generated)</p>
            </div>
            <div className="flex items-center justify-between border-t border-[var(--border)] pt-1.5 font-semibold text-[var(--foreground)]">
              <span>Gross Pay</span>
              <span>{formatCurrency(payroll.grossPay)}</span>
            </div>
          </div>
        </div>

        <div className="border-b border-dashed border-[var(--border)] py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Deductions</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between text-[var(--muted)]">
              <span>Absent + LOP days</span>
              <span>{payroll.absentDays + payroll.lopDays}</span>
            </div>
            <div className="flex items-center justify-between text-[var(--muted)]">
              <span>Half Day</span>
              <span>{payroll.halfDays} (0.5)</span>
            </div>
            <div className="flex items-center justify-between font-semibold text-red-600">
              <span>Deduction</span>
              <span>-{formatCurrency(payroll.leaveDeduction)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-dashed border-[var(--border)] py-4 text-lg font-bold text-[var(--foreground)]">
          <span>Net Pay</span>
          <span>{formatCurrency(payroll.netPay)}</span>
        </div>

        <div className="pt-4 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Attendance Summary</p>
          <p className="text-[var(--muted)]">
            Present: {payroll.presentDays} | Absent: {payroll.absentDays} | Leave (paid): {payroll.paidLeaveDays} | Leave
            (LOP): {payroll.lopDays} | Half Day: {payroll.halfDays}
          </p>
        </div>
      </div>
    </div>
  );
}
