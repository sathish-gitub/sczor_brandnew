import { Bell, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings" },
        ]}
      />

      <section className="rounded-xl border border-[var(--border)] bg-white p-5">
        <h2 className="text-base font-semibold text-[var(--foreground)]">Notifications</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Control communication preferences for salon operations.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--border)] bg-slate-50 p-4">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <Bell className="h-4 w-4" />
            </div>
            <p className="mt-3 text-sm font-semibold">Operational Alerts</p>
            <p className="text-xs text-[var(--muted)]">Appointment reminders, cancellation alerts and billing activity.</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-slate-50 p-4">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <p className="mt-3 text-sm font-semibold">Security Events</p>
            <p className="text-xs text-[var(--muted)]">Password change notices and team-access changes.</p>
          </div>
        </div>

        <p className="mt-5 text-sm text-[var(--muted)]">Use the left menu to configure salon profile, business hours, tax, account security, and subscription preferences.</p>
      </section>
    </div>
  );
}
