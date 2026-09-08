const FEATURES = [
  "All 9 modules included",
  "Unlimited appointments",
  "POS & GST billing",
  "Loyalty program",
  "Reports & analytics",
  "Priority support",
];

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
            <p className="mb-1 text-sm text-gray-500">Monthly</p>
            <p className="text-3xl font-bold text-[#0D1B3E]">₹599</p>
            <p className="text-xs text-gray-400">per month</p>
            <a
              href="mailto:connect@droletechnologies.com?subject=Subscribe%20to%20Monthly%20Plan"
              className="mt-4 block w-full rounded-lg bg-[#1E40AF] py-2 text-sm font-medium text-white"
            >
              Subscribe Monthly
            </a>
          </div>

          <div className="relative rounded-xl border-2 border-[#1E40AF] p-4">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-green-500 px-2 py-0.5 text-xs text-white">
              Save 17%
            </span>
            <p className="mb-1 text-sm text-gray-500">Yearly</p>
            <p className="text-3xl font-bold text-[#0D1B3E]">₹5,999</p>
            <p className="text-xs text-gray-400">per year</p>
            <a
              href="mailto:connect@droletechnologies.com?subject=Subscribe%20to%20Yearly%20Plan"
              className="mt-4 block w-full rounded-lg bg-[#1E40AF] py-2 text-sm font-medium text-white"
            >
              Subscribe Yearly
            </a>
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
          Need help? Contact us at{" "}
          <a href="mailto:connect@droletechnologies.com" className="text-blue-600 underline">
            connect@droletechnologies.com
          </a>
        </p>
      </div>
    </div>
  );
}
