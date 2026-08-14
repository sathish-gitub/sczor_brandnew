"use client";

import { useEffect, useState } from "react";

type SettingsPayload = {
  pointsPerTenRupees: number;
  rupeePerPoint: number;
  minPointsToRedeem: number;
  maxRedeemPercent: number;
  pointsExpiryEnabled: boolean;
  pointsExpiryMonths: number;
  silverThreshold: number;
  goldThreshold: number;
  platinumThreshold: number;
};

const defaults: SettingsPayload = {
  pointsPerTenRupees: 1,
  rupeePerPoint: 1,
  minPointsToRedeem: 100,
  maxRedeemPercent: 50,
  pointsExpiryEnabled: false,
  pointsExpiryMonths: 12,
  silverThreshold: 500,
  goldThreshold: 2000,
  platinumThreshold: 5000,
};

export default function LoyaltySettingsPage() {
  const [settings, setSettings] = useState<SettingsPayload>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const response = await fetch("/api/loyalty/settings", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { error?: string; settings?: SettingsPayload } | null;

      if (!active) {
        return;
      }

      if (!response.ok || !payload?.settings) {
        setError(payload?.error ?? "Unable to load settings.");
        setLoading(false);
        return;
      }

      setSettings(payload.settings);
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/loyalty/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settings),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setError(payload?.error ?? "Unable to save settings.");
      setSaving(false);
      return;
    }

    setSaving(false);
    setSuccess("Settings updated successfully.");
  }

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl border border-[var(--border)] bg-white" />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      <header>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Loyalty Settings</h1>
      </header>

      <section className="space-y-4 rounded-xl border border-[var(--border)] bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-[var(--muted)]">Points per Rs 10 spent</span>
            <input type="number" min={0.1} step="0.1" value={settings.pointsPerTenRupees} onChange={(e) => setSettings((s) => ({ ...s, pointsPerTenRupees: Number(e.target.value) || 0 }))} className="mt-1 h-10 w-full rounded-xl border border-[var(--border)] px-3" />
          </label>
          <label className="text-sm">
            <span className="text-[var(--muted)]">Rupee value per point</span>
            <input type="number" min={0.1} step="0.1" value={settings.rupeePerPoint} onChange={(e) => setSettings((s) => ({ ...s, rupeePerPoint: Number(e.target.value) || 0 }))} className="mt-1 h-10 w-full rounded-xl border border-[var(--border)] px-3" />
          </label>
          <label className="text-sm">
            <span className="text-[var(--muted)]">Min points to redeem</span>
            <input type="number" min={0} value={settings.minPointsToRedeem} onChange={(e) => setSettings((s) => ({ ...s, minPointsToRedeem: Number(e.target.value) || 0 }))} className="mt-1 h-10 w-full rounded-xl border border-[var(--border)] px-3" />
          </label>
          <label className="text-sm">
            <span className="text-[var(--muted)]">Max redeem % per invoice</span>
            <input type="number" min={1} max={100} value={settings.maxRedeemPercent} onChange={(e) => setSettings((s) => ({ ...s, maxRedeemPercent: Number(e.target.value) || 0 }))} className="mt-1 h-10 w-full rounded-xl border border-[var(--border)] px-3" />
          </label>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-slate-50 p-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.pointsExpiryEnabled} onChange={(e) => setSettings((s) => ({ ...s, pointsExpiryEnabled: e.target.checked }))} className="h-4 w-4" />
            Enable points expiry
          </label>
          {settings.pointsExpiryEnabled ? (
            <label className="mt-2 block text-sm">
              <span className="text-[var(--muted)]">Expiry months</span>
              <input type="number" min={1} max={120} value={settings.pointsExpiryMonths} onChange={(e) => setSettings((s) => ({ ...s, pointsExpiryMonths: Number(e.target.value) || 1 }))} className="mt-1 h-10 w-full rounded-xl border border-[var(--border)] px-3" />
            </label>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm">
            <span className="text-[var(--muted)]">Silver threshold</span>
            <input type="number" min={1} value={settings.silverThreshold} onChange={(e) => setSettings((s) => ({ ...s, silverThreshold: Number(e.target.value) || 1 }))} className="mt-1 h-10 w-full rounded-xl border border-[var(--border)] px-3" />
          </label>
          <label className="text-sm">
            <span className="text-[var(--muted)]">Gold threshold</span>
            <input type="number" min={1} value={settings.goldThreshold} onChange={(e) => setSettings((s) => ({ ...s, goldThreshold: Number(e.target.value) || 1 }))} className="mt-1 h-10 w-full rounded-xl border border-[var(--border)] px-3" />
          </label>
          <label className="text-sm">
            <span className="text-[var(--muted)]">Platinum threshold</span>
            <input type="number" min={1} value={settings.platinumThreshold} onChange={(e) => setSettings((s) => ({ ...s, platinumThreshold: Number(e.target.value) || 1 }))} className="mt-1 h-10 w-full rounded-xl border border-[var(--border)] px-3" />
          </label>
        </div>

        <button type="button" onClick={save} disabled={saving} className="h-10 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </section>
    </div>
  );
}
