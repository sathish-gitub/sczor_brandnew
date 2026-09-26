"use client";

import { useEffect, useState } from "react";

import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";

type PayrollSettingsForm = {
  defaultPaidLeavesPerMonth: number;
};

const defaults: PayrollSettingsForm = {
  defaultPaidLeavesPerMonth: 1,
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

        <button type="button" onClick={onSave} disabled={saving} className="h-10 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-70">
          {saving ? "Saving..." : "Save Payroll Settings"}
        </button>
      </section>
    </div>
  );
}
