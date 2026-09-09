"use client";

import Script from "next/script";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Check, CheckCircle2, LoaderCircle, Mail } from "lucide-react";

import { PRICING_PLANS } from "@/lib/pricing";
import { BillingToggle, type BillingCycle } from "@/components/pricing/BillingToggle";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

type PlanKey = "TRIAL" | "MONTHLY" | "YEARLY" | "BUSINESS";

export default function SelectPlanPage() {
  return (
    <Suspense fallback={null}>
      <SelectPlanContent />
    </Suspense>
  );
}

function SelectPlanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPlan = searchParams.get("plan") as PlanKey | null;
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    preselectedPlan === "YEARLY" ? "YEARLY" : "MONTHLY",
  );
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const middlePlan = billingCycle === "MONTHLY" ? PRICING_PLANS.MONTHLY : PRICING_PLANS.YEARLY;

  async function startTrial() {
    setLoadingPlan("TRIAL");
    setError(null);
    try {
      const response = await fetch("/api/subscription/select-trial", { method: "PATCH" });
      if (!response.ok) {
        throw new Error("Unable to start trial");
      }
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoadingPlan(null);
    }
  }

  async function subscribe(plan: "MONTHLY" | "YEARLY") {
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
            router.push("/onboarding");
          } else {
            setError("Payment verification failed. Please contact support.");
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

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-10 sm:px-8">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col items-center text-center">
          <Link href="/" aria-label="Go to homepage" className="mb-6 inline-block">
            <Image
              src="/images/sczor_logo_dark.png"
              alt="sczor"
              width={144}
              height={48}
              className="h-10 w-auto"
              priority
            />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
            Choose Your Plan
          </h1>
          <p className="mt-2 text-[var(--muted)]">Start your salon management journey</p>
        </div>

        {error ? (
          <div className="mx-auto mb-6 max-w-xl rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mb-8 flex justify-center">
          <BillingToggle value={billingCycle} onChange={setBillingCycle} />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <PlanCard
            emoji="🎉"
            title={PRICING_PLANS.TRIAL.name}
            price="₹0"
            period={`/ ${PRICING_PLANS.TRIAL.duration}`}
            features={[...PRICING_PLANS.TRIAL.features]}
            ctaLabel="Start Free Trial"
            ctaVariant="outline"
            highlighted={preselectedPlan === "TRIAL"}
            preselected={preselectedPlan === "TRIAL"}
            loading={loadingPlan === "TRIAL"}
            onClick={startTrial}
          />

          <PlanCard
            badge={middlePlan.badge}
            title={middlePlan.name}
            price={`₹${middlePlan.price.toLocaleString("en-IN")}`}
            period={
              billingCycle === "YEARLY"
                ? `/ year (₹${PRICING_PLANS.YEARLY.monthlyEquivalent}/month · Save ₹${PRICING_PLANS.YEARLY.savings})`
                : "/ month"
            }
            highlighted
            features={[...middlePlan.features]}
            ctaLabel="Get Started"
            ctaVariant="filled"
            preselected={preselectedPlan === billingCycle}
            loading={loadingPlan === billingCycle}
            onClick={() => subscribe(billingCycle)}
          />

          <PlanCard
            badge={PRICING_PLANS.BUSINESS.badge}
            title={PRICING_PLANS.BUSINESS.name}
            price={PRICING_PLANS.BUSINESS.priceLabel}
            period=""
            highlighted={preselectedPlan === "BUSINESS"}
            features={[...PRICING_PLANS.BUSINESS.features]}
            ctaLabel="Contact Us for Pricing"
            ctaVariant="dark"
            preselected={false}
            loading={false}
            onClick={() => router.push("/contact")}
          />
        </div>

        <div className="mt-10 text-center text-sm text-[var(--muted)]">
          Have questions?{" "}
          <a
            href="mailto:connect@droletechnologies.com"
            className="inline-flex items-center gap-1 font-semibold text-[var(--accent)] hover:text-[var(--primary)]"
          >
            <Mail className="h-4 w-4" />
            Contact Us
          </a>
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  emoji,
  badge,
  title,
  price,
  period,
  features,
  ctaLabel,
  ctaVariant,
  highlighted,
  preselected,
  loading,
  onClick,
}: {
  emoji?: string;
  badge?: string;
  title: string;
  price: string;
  period: string;
  features: string[];
  ctaLabel: string;
  ctaVariant: "outline" | "filled" | "dark";
  highlighted?: boolean;
  preselected: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  const ctaClasses = {
    outline: "border-2 border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/10",
    filled: "bg-[var(--primary)] text-white hover:bg-[var(--accent)]",
    dark: "bg-[#0D1B3E] text-white hover:bg-[#132352]",
  }[ctaVariant];

  return (
    <div
      className={[
        "flex flex-col rounded-2xl border bg-white p-6 transition-all",
        highlighted ? "border-[var(--accent)] shadow-[0_20px_50px_rgba(37,99,235,0.18)] md:scale-105" : "border-[var(--border)]",
      ].join(" ")}
    >
      {badge ? (
        <p className="mb-2 text-sm font-semibold text-[var(--accent)]">{badge}</p>
      ) : emoji ? (
        <p className="mb-2 text-2xl">{emoji}</p>
      ) : null}

      {preselected ? (
        <p className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
          <Check className="h-3.5 w-3.5" />
          Your selected plan
        </p>
      ) : null}

      <h3 className="text-lg font-semibold text-[var(--foreground)]">{title}</h3>
      <div className="mt-3">
        <span className="text-3xl font-bold text-[var(--foreground)]">{price}</span>
        <span className="ml-1 text-sm text-[var(--muted)]">{period}</span>
      </div>

      <ul className="mt-5 flex-1 space-y-2.5">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-[var(--foreground)]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            {feature}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className={[
          "mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-70",
          ctaClasses,
        ].join(" ")}
      >
        {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        {ctaLabel}
      </button>
    </div>
  );
}
