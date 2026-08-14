"use client";

import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";

type TaxBillingForm = {
  gstNumber: string;
  gstEnabled: boolean;
  gstRate: number;
  invoicePrefix: string;
  invoiceNumberFormat: "INV-YYYY-XXXX" | "INV-XXXX";
  invoiceStartNumber: number;
  invoiceFooter: string;
  invoiceTerms: string;
  currency: string;
  currencySymbol: string;
  paymentMethods: {
    cash: boolean;
    upi: boolean;
    card: boolean;
    wallet: boolean;
  };
  upiId: string;
};

const defaults: TaxBillingForm = {
  gstNumber: "",
  gstEnabled: true,
  gstRate: 18,
  invoicePrefix: "INV",
  invoiceNumberFormat: "INV-YYYY-XXXX",
  invoiceStartNumber: 1,
  invoiceFooter: "",
  invoiceTerms: "",
  currency: "INR",
  currencySymbol: "Rs",
  paymentMethods: {
    cash: true,
    upi: true,
    card: true,
    wallet: true,
  },
  upiId: "",
};

export default function TaxBillingPage() {
  const { showToast } = useToast();
  const [form, setForm] = useState<TaxBillingForm>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      const response = await fetch("/api/settings", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { taxBilling?: TaxBillingForm; error?: string } | null;

      if (!active) {
        return;
      }

      if (!response.ok || !payload?.taxBilling) {
        showToast({ variant: "error", title: "Unable to load billing settings", message: payload?.error });
        setLoading(false);
        return;
      }

      setForm(payload.taxBilling);
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [showToast]);

  const cgst = useMemo(() => Number((form.gstRate / 2).toFixed(2)), [form.gstRate]);
  const sgst = useMemo(() => Number((form.gstRate / 2).toFixed(2)), [form.gstRate]);

  async function onSave() {
    setSaving(true);

    const response = await fetch("/api/settings/tax-billing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      showToast({ variant: "error", title: "Save failed", message: payload?.error ?? "Unable to update billing settings." });
      setSaving(false);
      return;
    }

    showToast({ variant: "success", title: "Billing settings saved" });
    setSaving(false);
  }

  if (loading) {
    return <div className="h-72 animate-pulse rounded-xl border border-[var(--border)] bg-white" />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tax & Billing"
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Tax & Billing" },
        ]}
      />

      <section className="space-y-6 rounded-xl border border-[var(--border)] bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="GST Number" value={form.gstNumber} onChange={(value) => setForm((current) => ({ ...current, gstNumber: value }))} />
          <label className="inline-flex items-center gap-2 self-end pb-2 text-sm font-semibold">
            <input type="checkbox" checked={form.gstEnabled} onChange={(event) => setForm((current) => ({ ...current, gstEnabled: event.target.checked }))} />
            Enable GST
          </label>
          <NumberField label="GST Rate (%)" value={form.gstRate} onChange={(value) => setForm((current) => ({ ...current, gstRate: value }))} />
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="CGST" value={cgst} onChange={() => undefined} disabled />
            <NumberField label="SGST" value={sgst} onChange={() => undefined} disabled />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Invoice Prefix" value={form.invoicePrefix} onChange={(value) => setForm((current) => ({ ...current, invoicePrefix: value }))} />
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Invoice Number Format</span>
            <select value={form.invoiceNumberFormat} onChange={(event) => setForm((current) => ({ ...current, invoiceNumberFormat: event.target.value as TaxBillingForm["invoiceNumberFormat"] }))} className="mt-1 h-10 w-full rounded-xl border border-[var(--border)] px-3">
              <option value="INV-YYYY-XXXX">INV-YYYY-XXXX</option>
              <option value="INV-XXXX">INV-XXXX</option>
            </select>
          </label>
          <NumberField label="Starting Invoice Number" value={form.invoiceStartNumber} onChange={(value) => setForm((current) => ({ ...current, invoiceStartNumber: value }))} />
          <Field label="UPI ID" value={form.upiId} onChange={(value) => setForm((current) => ({ ...current, upiId: value }))} />
        </div>

        <label className="block text-sm">
          <span className="text-[var(--muted)]">Invoice Footer</span>
          <textarea rows={2} value={form.invoiceFooter} onChange={(event) => setForm((current) => ({ ...current, invoiceFooter: event.target.value }))} className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2" />
        </label>

        <label className="block text-sm">
          <span className="text-[var(--muted)]">Terms & Conditions</span>
          <textarea rows={3} value={form.invoiceTerms} onChange={(event) => setForm((current) => ({ ...current, invoiceTerms: event.target.value }))} className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2" />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Currency" value={form.currency} onChange={(value) => setForm((current) => ({ ...current, currency: value }))} />
          <Field label="Currency Symbol" value={form.currencySymbol} onChange={(value) => setForm((current) => ({ ...current, currencySymbol: value }))} />
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">Payment Methods</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { key: "cash", label: "Cash" },
              { key: "upi", label: "UPI" },
              { key: "card", label: "Card" },
              { key: "wallet", label: "Wallet" },
            ].map((option) => (
              <label key={option.key} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.paymentMethods[option.key as keyof TaxBillingForm["paymentMethods"]]}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      paymentMethods: {
                        ...current.paymentMethods,
                        [option.key]: event.target.checked,
                      },
                    }))
                  }
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        <button type="button" onClick={onSave} disabled={saving} className="h-10 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-70">
          {saving ? "Saving..." : "Save Tax & Billing"}
        </button>
      </section>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[var(--border)] px-3" />
    </label>
  );
}

function NumberField({ label, value, onChange, disabled = false }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean }) {
  return (
    <label className="block text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <input
        type="number"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        className="mt-1 h-10 w-full rounded-xl border border-[var(--border)] px-3 disabled:opacity-60"
      />
    </label>
  );
}
