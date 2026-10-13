"use client";

import { useEffect, useState } from "react";

import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { PAYROLL_DAY_METHOD_INFO, PAYROLL_DAY_METHOD_VALUES, type PayrollDayMethod } from "@/lib/payrollDayMethod";

type PayrollSettingsForm = {
  defaultPaidLeavesPerMonth: number;
  payrollDayMethod: PayrollDayMethod;
};

const defaults: PayrollSettingsForm = {
  defaultPaidLeavesPerMonth: 1,
  payrollDayMethod: "CALENDAR_DAYS",
};

export default function PayrollSettingsPage() {
  const { showToast } = useToast();
  const [form, setForm] = useState<PayrollSettingsForm>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      const response = await fetch("/api/settings", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { payroll?: PayrollSettingsForm; error?: string } | null;

      if (!active) {
        return;
      }

      if (!response.ok || !payload?.payroll) {
        showToast({ variant: "error", title: "Unable to load payroll settings", message: payload?.error });
        setLoading(false);
        return;
      }

      setForm(payload.payroll);
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [showToast]);

  async function onSave() {
    setSaving(true);

    const response = await fetch("/api/settings/payroll", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      showToast({ variant: "error", title: "Save failed", message: payload?.error ?? "Unable to update payroll settings." });
      setSaving(false);
      return;
    }

    showToast({ variant: "success", title: "Payroll settings saved" });
    setSaving(false);
  }

  if (loading) {
    return <div className="h-72 animate-pulse rounded-xl border border-[var(--border)] bg-white" />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payroll"
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Payroll" },
        ]}
      />

      <section className="space-y-4 rounded-xl border border-[var(--border)] bg-white p-5">
        <div className="max-w-xs">
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Default Paid Leaves Per Month</span>
            <input
              type="number"
              min={0}
              max={31}
              value={form.defaultPaidLeavesPerMonth}
              onChange={(event) =>
                setForm((current) => ({ ...current, defaultPaidLeavesPerMonth: Number(event.target.value) || 0 }))
              }
              className="mt-1 h-10 w-full rounded-xl border border-[var(--border)] px-3"
            />
          </label>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Applies to all staff unless a staff member has a custom leave allowance set on their profile.
          </p>
        </div>

        <div className="max-w-xl border-t border-[var(--border)] pt-4">
          <span className="block text-sm text-[var(--muted)]">Daily Salary Method</span>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Used to turn a staff member&apos;s monthly salary into a per-day rate for Absent, Half Day and unpaid Leave (LOP)
            deductions.
          </p>
          <div className="mt-3 space-y-2">
            {PAYROLL_DAY_METHOD_VALUES.map((method) => {
              const info = PAYROLL_DAY_METHOD_INFO[method];
              return (
                <label
                  key={method}
                  className={`block cursor-pointer rounded-xl border px-3 py-2.5 ${
                    form.payrollDayMethod === method ? "border-[var(--primary)] bg-[var(--primary)]/5" : "border-[var(--border)]"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="payrollDayMethod"
                      checked={form.payrollDayMethod === method}
                      onChange={() => setForm((current) => ({ ...current, payrollDayMethod: method }))}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">{info.label}</p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">{info.description}</p>
                      <p className="mt-0.5 text-xs italic text-[var(--muted)]">e.g. {info.example}</p>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <button type="button" onClick={onSave} disabled={saving} className="h-10 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-70">
          {saving ? "Saving..." : "Save Payroll Settings"}
        </button>
      </section>
    </div>
  );
}
