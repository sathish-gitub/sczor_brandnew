import Link from "next/link";

import { PRICING_PLANS } from "@/lib/pricing";

const FEATURES = PRICING_PLANS.MONTHLY.features;

export default function SubscriptionRequiredPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F0F4FF] p-6">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <span className="text-3xl">⏰</span>
        </div>

        <h1 className="mb-2 text-2xl font-bold text-[#0D1B3E]">Your free trial has ended</h1>
        <p className="mb-8 text-gray-500">
          Subscribe to continue using sczor and access all your salon data.
        </p>

        <div className="mb-8 grid grid-cols-2 gap-4">
          <div className="rounded-xl border-2 border-gray-200 p-4">
            <p className="mb-1 text-sm text-gray-500">{PRICING_PLANS.MONTHLY.name}</p>
            <p className="text-3xl font-bold text-[#0D1B3E]">₹{PRICING_PLANS.MONTHLY.price.toLocaleString("en-IN")}</p>
            <p className="text-xs text-gray-400">per {PRICING_PLANS.MONTHLY.period}</p>
            <Link
              href="/settings/subscription?billing=MONTHLY"
              className="mt-4 block w-full rounded-lg bg-[#1E40AF] py-2 text-sm font-medium text-white"
            >
              Subscribe Monthly
            </Link>
          </div>

          <div className="relative rounded-xl border-2 border-[#1E40AF] p-4">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-green-500 px-2 py-0.5 text-xs text-white">
              Save {PRICING_PLANS.YEARLY.savingsPercent}%
            </span>
            <p className="mb-1 text-sm text-gray-500">{PRICING_PLANS.YEARLY.name}</p>
            <p className="text-3xl font-bold text-[#0D1B3E]">₹{PRICING_PLANS.YEARLY.price.toLocaleString("en-IN")}</p>
            <p className="text-xs text-gray-400">per {PRICING_PLANS.YEARLY.period}</p>
            <Link
              href="/settings/subscription?billing=YEARLY"
              className="mt-4 block w-full rounded-lg bg-[#1E40AF] py-2 text-sm font-medium text-white"
            >
              Subscribe Yearly
            </Link>
          </div>
        </div>

        <div className="mb-6 space-y-2 text-left">
          {FEATURES.map((feature) => (
            <div key={feature} className="flex items-center gap-2 text-sm">
              <span className="text-green-500">✓</span>
              <span>{feature}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400">
          Need a multi-branch / franchise plan instead?{" "}
          <Link href="/contact" className="text-blue-600 underline">
            Contact us
          </Link>
        </p>
      </div>
    </div>
  );
}
