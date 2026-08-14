"use client";

import { ChangeEvent, useEffect, useState } from "react";
import Image from "next/image";

import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";

type SalonProfileForm = {
  logo: string;
  salonName: string;
  tagline: string;
  phone: string;
  email: string;
  website: string;
  gstNumber: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
};

const defaultForm: SalonProfileForm = {
  logo: "",
  salonName: "",
  tagline: "",
  phone: "",
  email: "",
  website: "",
  gstNumber: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
};

export default function SalonProfileSettingsPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SalonProfileForm>(defaultForm);

  useEffect(() => {
    let active = true;

    async function load() {
      const response = await fetch("/api/settings", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { salonProfile?: SalonProfileForm; error?: string } | null;

      if (!active) {
        return;
      }

      if (!response.ok || !payload?.salonProfile) {
        showToast({ variant: "error", title: "Unable to load salon profile", message: payload?.error });
        setLoading(false);
        return;
      }

      setForm(payload.salonProfile);
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [showToast]);

  function onLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      setForm((current) => ({ ...current, logo: value }));
    };
    reader.readAsDataURL(file);
  }

  async function onSave() {
    setSaving(true);

    const response = await fetch("/api/settings/salon-profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      showToast({ variant: "error", title: "Save failed", message: payload?.error ?? "Could not update profile." });
      setSaving(false);
      return;
    }

    showToast({ variant: "success", title: "Salon profile updated" });
    setSaving(false);
  }

  if (loading) {
    return <div className="h-72 animate-pulse rounded-xl border border-[var(--border)] bg-white" />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Salon Profile"
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Salon Profile" },
        ]}
      />

      <section className="space-y-4 rounded-xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 overflow-hidden rounded-xl border border-[var(--border)] bg-slate-50">
            {form.logo ? <Image src={form.logo} alt="Salon logo preview" width={80} height={80} className="h-full w-full object-cover" /> : null}
          </div>
          <label className="inline-flex h-10 cursor-pointer items-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700">
            Upload Logo
            <input type="file" accept="image/*" className="hidden" onChange={onLogoChange} />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Salon Name*" value={form.salonName} onChange={(value) => setForm((current) => ({ ...current, salonName: value }))} />
          <Field label="Tagline" value={form.tagline} onChange={(value) => setForm((current) => ({ ...current, tagline: value }))} />
          <Field label="Phone*" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} />
          <Field label="Email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} />
          <Field label="Website" value={form.website} onChange={(value) => setForm((current) => ({ ...current, website: value }))} />
          <Field label="GST Number" value={form.gstNumber} onChange={(value) => setForm((current) => ({ ...current, gstNumber: value }))} />
        </div>

        <label className="block text-sm">
          <span className="text-[var(--muted)]">Address</span>
          <textarea
            rows={3}
            value={form.address}
            onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
            className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="City" value={form.city} onChange={(value) => setForm((current) => ({ ...current, city: value }))} />
          <Field label="State" value={form.state} onChange={(value) => setForm((current) => ({ ...current, state: value }))} />
          <Field label="Pincode" value={form.pincode} onChange={(value) => setForm((current) => ({ ...current, pincode: value }))} />
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="h-10 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-70"
        >
          {saving ? "Saving..." : "Save Profile"}
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
