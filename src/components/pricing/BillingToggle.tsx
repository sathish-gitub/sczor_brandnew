"use client";

export type BillingCycle = "MONTHLY" | "YEARLY";

export function BillingToggle({
  value,
  onChange,
}: {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
}) {
  const isYearly = value === "YEARLY";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="inline-flex items-center gap-3">
        <span
          className={`text-sm font-semibold ${isYearly ? "text-slate-500" : "text-[#1E40AF]"}`}
        >
          Monthly
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isYearly}
          onClick={() => onChange(isYearly ? "MONTHLY" : "YEARLY")}
          className={`relative h-7 w-14 shrink-0 rounded-full transition-colors ${
            isYearly ? "bg-[#1E40AF]" : "bg-slate-300"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
              isYearly ? "translate-x-7" : "translate-x-0"
            }`}
          />
        </button>
        <span
          className={`text-sm font-semibold ${isYearly ? "text-[#1E40AF]" : "text-slate-500"}`}
        >
          Yearly
        </span>
        {isYearly ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
            Save 17%
          </span>
        ) : null}
      </div>
    </div>
  );
}
