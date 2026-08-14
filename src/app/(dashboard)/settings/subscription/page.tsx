"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";

export default function SubscriptionPage() {
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [submittingPlan, setSubmittingPlan] = useState<"BASIC" | "PRO" | null>(null);

  async function notify(plan: "BASIC" | "PRO") {
    if (!email.trim()) {
      showToast({ variant: "warning", title: "Enter an email for waitlist notifications" });
      return;
    }

    setSubmittingPlan(plan);

    const response = await fetch("/api/settings/subscription/waitlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        plan,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      showToast({ variant: "error", title: "Unable to save request", message: payload?.error });
      setSubmittingPlan(null);
      return;
    }

    showToast({ variant: "success", title: `${plan} waitlist joined` });
    setSubmittingPlan(null);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Subscription"
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Subscription" },
        ]}
      />

      <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6">
        <p className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">
          <Sparkles className="h-3.5 w-3.5" />
          Free Plan
        </p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">Currently active</h2>
        <ul className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          <li>All modules included</li>
          <li>Unlimited appointments</li>
          <li>Unlimited customers</li>
          <li>POS & Billing</li>
          <li>Reports & Analytics</li>
          <li>Loyalty Program</li>
        </ul>
        <p className="mt-4 text-sm font-semibold text-emerald-700">Premium plans coming soon!</p>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-5">
        <label className="block text-sm">
          <span className="text-[var(--muted)]">Email for launch alerts</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[var(--border)] px-3" placeholder="owner@salon.com" />
        </label>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <PlanCard
            title="BASIC"
            price="Rs 799/month"
            points={["Single branch", "SMS alerts", "Priority support"]}
            onNotify={() => notify("BASIC")}
            loading={submittingPlan === "BASIC"}
          />
          <PlanCard
            title="PRO"
            price="Rs 1099/month"
            points={["Multi-branch", "SMS + WA", "API access", "White label"]}
            onNotify={() => notify("PRO")}
            loading={submittingPlan === "PRO"}
          />
        </div>
      </section>
    </div>
  );
}

function PlanCard({
  title,
  price,
  points,
  onNotify,
  loading,
}: {
  title: string;
  price: string;
  points: string[];
  onNotify: () => void;
  loading: boolean;
}) {
  return (
    <article className="rounded-xl border border-[var(--border)] bg-slate-50 p-4">
      <h3 className="text-lg font-bold text-[var(--foreground)]">{title}</h3>
      <p className="text-sm font-semibold text-[var(--muted)]">{price}</p>
      <ul className="mt-3 space-y-1 text-sm text-slate-700">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <button type="button" onClick={onNotify} disabled={loading} className="mt-4 h-9 rounded-lg border border-[var(--border)] bg-white px-3 text-sm font-semibold text-slate-700 disabled:opacity-70">
        {loading ? "Saving..." : "Notify Me"}
      </button>
    </article>
  );
}
