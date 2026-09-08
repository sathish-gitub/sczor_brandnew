"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, LoaderCircle, Plug, Save } from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";

type Settings = {
  razorpayKeyId: string;
  razorpayKeySecret: string;
  razorpayWebhookSecret: string;
};

type SettingsResponse = {
  razorpayKeyId: string;
  razorpayKeySecret: string;
  razorpayWebhookSecret: string;
};

function SecretField({
  label,
  value,
  onChange,
  currentMasked,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  currentMasked?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">{label}</label>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full rounded-xl border border-[var(--border)] px-3 pr-11 text-sm outline-none focus:border-[var(--accent)]"
          placeholder={currentMasked ? `Current: ${currentMasked}` : "Not configured"}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-[var(--foreground)]"
          aria-label={visible ? "Hide" : "Show"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">Leave blank to keep the current value.</p>
    </div>
  );
}

export default function SuperAdminSettingsPage() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<Settings>({
    razorpayKeyId: "",
    razorpayKeySecret: "",
    razorpayWebhookSecret: "",
  });
  const [currentMasked, setCurrentMasked] = useState<SettingsResponse>({
    razorpayKeyId: "",
    razorpayKeySecret: "",
    razorpayWebhookSecret: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch("/api/super-admin/settings", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.settings) {
          throw new Error(payload?.error ?? "Failed to load settings");
        }
        setCurrentMasked({
          razorpayKeyId: payload.settings.razorpayKeyId ?? "",
          razorpayKeySecret: payload.settings.razorpayKeySecret ?? "",
          razorpayWebhookSecret: payload.settings.razorpayWebhookSecret ?? "",
        });
        // Key ID isn't a secret, so it's safe to prefill for editing. The secret fields
        // start blank - the server only returns masked values, and submitting them
        // back unchanged would be meaningless (and is ignored server-side anyway).
        setSettings({
          razorpayKeyId: payload.settings.razorpayKeyId ?? "",
          razorpayKeySecret: "",
          razorpayWebhookSecret: "",
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/super-admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.settings) {
        showToast({ title: "Failed to save keys", variant: "error" });
        return;
      }

      setCurrentMasked({
        razorpayKeyId: payload.settings.razorpayKeyId ?? "",
        razorpayKeySecret: payload.settings.razorpayKeySecret ?? "",
        razorpayWebhookSecret: payload.settings.razorpayWebhookSecret ?? "",
      });
      setSettings((prev) => ({ ...prev, razorpayKeySecret: "", razorpayWebhookSecret: "" }));

      showToast({ title: "Razorpay keys saved", variant: "success" });
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    try {
      const response = await fetch("/api/super-admin/settings/test-connection", { method: "POST" });
      const payload = await response.json();

      if (response.ok && payload.success) {
        showToast({ title: "Razorpay connection successful", variant: "success" });
      } else {
        showToast({ title: payload.error ?? "Connection failed", variant: "error" });
      }
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-[var(--muted)]">
        <LoaderCircle className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />

      <div className="max-w-2xl rounded-2xl border border-[var(--border)] bg-white p-5">
        <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--foreground)]">
          💳 Razorpay Payment Gateway
        </h3>
        <div className="mt-4 space-y-4">
          <SecretField
            label="Key ID"
            value={settings?.razorpayKeyId ?? ""}
            onChange={(value) => setSettings((prev) => ({ ...prev, razorpayKeyId: value }))}
          />
          <SecretField
            label="Key Secret"
            value={settings?.razorpayKeySecret ?? ""}
            onChange={(value) => setSettings((prev) => ({ ...prev, razorpayKeySecret: value }))}
            currentMasked={currentMasked.razorpayKeySecret}
          />
          <SecretField
            label="Webhook Secret"
            value={settings?.razorpayWebhookSecret ?? ""}
            onChange={(value) => setSettings((prev) => ({ ...prev, razorpayWebhookSecret: value }))}
            currentMasked={currentMasked.razorpayWebhookSecret}
          />

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={testConnection}
              disabled={testing}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--foreground)] hover:bg-slate-50 disabled:opacity-70"
            >
              {testing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              Test Connection
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)] disabled:opacity-70"
            >
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Keys
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
