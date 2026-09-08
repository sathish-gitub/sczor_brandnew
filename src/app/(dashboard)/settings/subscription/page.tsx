"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { Check, CheckCircle2, LoaderCircle } from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { PRICING_PLANS } from "@/lib/pricing";
import { BillingToggle, type BillingCycle } from "@/components/pricing/BillingToggle";
import { getAccessStatus } from "@/lib/subscription";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

type SubscriptionInfo = {
  plan: string;
  trialEndsAt: string | null;
  isSubscribed: boolean;
  subscriptionStart: string | null;
  subscriptionEnd: string | null;
};

type PaymentRow = {
  id: string;
  plan: string;
  amount: number;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
};

type PlanKey = "MONTHLY" | "YEARLY";

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("MONTHLY");

  useEffect(() => {
    let active = true;

    async function loadSubscription() {
      try {
        const response = await fetch("/api/subscription/status", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as
          | { subscription?: SubscriptionInfo; payments?: PaymentRow[]; error?: string }
          | null;

        if (!response.ok || !payload?.subscription) {
          throw new Error(payload?.error ?? "Unable to load subscription status.");
        }

        if (!active) {
          return;
        }

        setSubscription(payload.subscription);
        setPayments(payload.payments ?? []);
        setBillingCycle(payload.subscription.plan === "YEARLY" ? "YEARLY" : "MONTHLY");
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load subscription status.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadSubscription();

    return () => {
      active = false;
    };
  }, [refreshKey]);

  async function subscribe(plan: PlanKey) {
    setLoadingPlan(plan);
    setError(null);

    try {
      const orderResponse = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const order = await orderResponse.json();

      if (!orderResponse.ok) {
        throw new Error(order?.error ?? "Unable to create order");
      }

      const razorpay = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "sczor",
        description: plan === "MONTHLY" ? "Monthly Subscription" : "Yearly Subscription",
        handler: async (paymentResponse: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const verifyResponse = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...paymentResponse, plan }),
          });

          if (verifyResponse.ok) {
            setLoadingPlan(null);
            setLoading(true);
            setRefreshKey((key) => key + 1);
          } else {
            setError("Payment verification failed. Please contact support.");
            setLoadingPlan(null);
          }
        },
        modal: {
          ondismiss: () => setLoadingPlan(null),
        },
        theme: { color: "#0D1B3E" },
      });

      razorpay.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoadingPlan(null);
    }
  }

  const middlePlan = billingCycle === "MONTHLY" ? PRICING_PLANS.MONTHLY : PRICING_PLANS.YEARLY;

  const access = subscription
    ? getAccessStatus({
        trialEndsAt: subscription.trialEndsAt ? new Date(subscription.trialEndsAt) : null,
        subscriptionEnd: subscription.subscriptionEnd ? new Date(subscription.subscriptionEnd) : null,
        isSubscribed: subscription.isSubscribed,
        plan: subscription.plan,
      })
    : null;

  return (
    <div className="space-y-4">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <PageHeader
        title="Subscription"
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Subscription" },
        ]}
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-6 text-sm text-[var(--muted)]">
          Loading subscription status...
        </div>
      ) : (
        <StatusCard access={access} />
      )}

      <section className="rounded-xl border border-[var(--border)] bg-white p-5">
        <h2 className="text-lg font-bold text-[var(--foreground)]">Plans</h2>

        <div className="mt-4 flex justify-center">
          <BillingToggle value={billingCycle} onChange={setBillingCycle} />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <PlanCard
            title={PRICING_PLANS.TRIAL.name}
            price="₹0"
            cycle={`/ ${PRICING_PLANS.TRIAL.duration}`}
            features={[...PRICING_PLANS.TRIAL.features]}
            state={
              subscription?.plan === "FREE_TRIAL"
                ? { kind: "info", label: `Trial Active — ${access?.daysLeft ?? 0} days left` }
                : { kind: "disabled", label: "Trial Ended" }
            }
          />

          <PlanCard
            title={middlePlan.name}
            price={`₹${middlePlan.price.toLocaleString("en-IN")}`}
            cycle={
              billingCycle === "YEARLY"
                ? `per ${middlePlan.period} (₹${PRICING_PLANS.YEARLY.monthlyEquivalent}/month)`
                : `per ${middlePlan.period}`
            }
            badge={billingCycle === "YEARLY" ? `Save ₹${PRICING_PLANS.YEARLY.savings}` : undefined}
            features={[...middlePlan.features]}
            highlighted
            state={
              subscription?.plan === billingCycle
                ? { kind: "current" }
                : {
                    kind: "action",
                    label:
                      subscription?.plan === "MONTHLY" || subscription?.plan === "YEARLY"
                        ? `Switch to ${billingCycle === "MONTHLY" ? "Monthly" : "Yearly"}`
                        : "Subscribe",
                    loading: loadingPlan === billingCycle,
                    onClick: () => subscribe(billingCycle),
                  }
            }
          />

          <PlanCard
            title={PRICING_PLANS.BUSINESS.name}
            price={PRICING_PLANS.BUSINESS.priceLabel}
            cycle=""
            features={[...PRICING_PLANS.BUSINESS.features]}
            state={
              subscription?.plan === "BUSINESS"
                ? { kind: "current" }
                : { kind: "link", label: "Contact Us for Pricing", href: "/contact" }
            }
          />
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-5">
        <h2 className="text-lg font-bold text-[var(--foreground)]">Payment History</h2>
        {payments.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">No payments yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Period</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3">{formatDate(payment.createdAt)}</td>
                    <td className="px-4 py-3">{payment.plan}</td>
                    <td className="px-4 py-3">{formatCurrency(payment.amount)}</td>
                    <td className="px-4 py-3">
                      <PaymentStatusBadge status={payment.status} />
                    </td>
                    <td className="px-4 py-3">
                      {payment.periodStart && payment.periodEnd
                        ? `${formatDate(payment.periodStart)} - ${formatDate(payment.periodEnd)}`
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    SUCCESS: "bg-emerald-100 text-emerald-700",
    PENDING: "bg-amber-100 text-amber-700",
    FAILED: "bg-red-100 text-red-700",
  };

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}

function StatusCard({ access }: { access: ReturnType<typeof getAccessStatus> | null }) {
  if (!access) {
    return null;
  }

  if (access.status === "ACTIVE") {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.08em] text-emerald-700">Subscribed</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Subscription active</h2>
        {access.renewalDate && (
          <p className="mt-2 text-sm text-slate-600">Renews on {formatDate(access.renewalDate.toISOString())}</p>
        )}
      </section>
    );
  }

  if (access.status === "TRIAL") {
    return (
      <section className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.08em] text-blue-700">14 days free trial</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{access.message}</h2>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-white p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.08em] text-red-700">
        {access.status === "SUBSCRIPTION_EXPIRED" ? "Subscription expired" : "Trial expired"}
      </p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Subscribe to continue using sczor</h2>
      <p className="mt-1 text-sm text-red-700">
        You&apos;re in read-only mode. Renew now to unlock creating and editing records.
      </p>
    </section>
  );
}

type PlanCardState =
  | { kind: "action"; label: string; loading: boolean; onClick: () => void }
  | { kind: "current" }
  | { kind: "info"; label: string }
  | { kind: "disabled"; label: string }
  | { kind: "link"; label: string; href: string };

function PlanCard({
  title,
  price,
  cycle,
  badge,
  features,
  state,
  highlighted,
}: {
  title: string;
  price: string;
  cycle: string;
  badge?: string;
  features: string[];
  state: PlanCardState;
  highlighted?: boolean;
}) {
  return (
    <article
      className={[
        "relative rounded-xl border bg-slate-50 p-4",
        highlighted ? "border-[var(--accent)] shadow-md" : "border-[var(--border)]",
      ].join(" ")}
    >
      {badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-green-500 px-2 py-0.5 text-xs text-white">
          {badge}
        </span>
      )}
      <h3 className="text-lg font-bold text-[var(--foreground)]">{title}</h3>
      <p className="text-2xl font-bold text-[var(--foreground)]">{price}</p>
      <p className="text-xs text-[var(--muted)]">{cycle}</p>
      <ul className="mt-3 space-y-1.5">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-xs text-[var(--foreground)]">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            {feature}
          </li>
        ))}
      </ul>

      {state.kind === "current" ? (
        <button
          type="button"
          disabled
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-100 px-3 py-2 text-center text-sm font-semibold text-emerald-700"
        >
          <Check className="h-4 w-4" />
          Current Plan
        </button>
      ) : state.kind === "info" ? (
        <p className="mt-4 flex w-full items-center justify-center rounded-lg bg-blue-50 px-3 py-2 text-center text-sm font-semibold text-blue-700">
          {state.label}
        </p>
      ) : state.kind === "disabled" ? (
        <button
          type="button"
          disabled
          className="mt-4 flex w-full items-center justify-center rounded-lg bg-slate-100 px-3 py-2 text-center text-sm font-semibold text-slate-400"
        >
          {state.label}
        </button>
      ) : state.kind === "link" ? (
        <a
          href={state.href}
          className="mt-4 flex w-full items-center justify-center rounded-lg bg-[var(--primary)] px-3 py-2 text-center text-sm font-semibold text-white hover:bg-[var(--accent)]"
        >
          {state.label}
        </a>
      ) : (
        <button
          type="button"
          onClick={state.onClick}
          disabled={state.loading}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-center text-sm font-semibold text-white hover:bg-[var(--accent)] disabled:opacity-70"
        >
          {state.loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {state.loading ? "Processing..." : state.label}
        </button>
      )}
    </article>
  );
}
