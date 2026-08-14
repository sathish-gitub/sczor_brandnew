type PaymentMethod = "CASH" | "UPI" | "CARD";

type SummaryInput = {
  subtotal: number;
  discountValue: number;
  discount: number;
  discountType: "PERCENT" | "FLAT";
  loyaltyDiscount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  total: number;
  paymentMethod: PaymentMethod;
  useLoyaltyPoints: boolean;
  loyaltyPointsToRedeem: number;
  loyaltyPointsAvailable: number;
};

type PaymentSummaryProps = {
  value: SummaryInput;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onDiscountTypeChange: (type: "PERCENT" | "FLAT") => void;
  onDiscountValueChange: (value: number) => void;
  onLoyaltyToggle: (enabled: boolean) => void;
  onLoyaltyPointsChange: (value: number) => void;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

const methods: Array<{ value: PaymentMethod; label: string }> = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
];

export function PaymentSummary({
  value,
  onPaymentMethodChange,
  onDiscountTypeChange,
  onDiscountValueChange,
  onLoyaltyToggle,
  onLoyaltyPointsChange,
}: PaymentSummaryProps) {
  return (
    <section className="space-y-4 rounded-xl border border-[var(--border)] bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Pricing</h2>

      <div className="space-y-1 text-sm">
        <p className="flex justify-between"><span className="text-[var(--muted)]">Subtotal</span><span>{formatCurrency(value.subtotal)}</span></p>
        <p className="flex justify-between"><span className="text-[var(--muted)]">Discount</span><span>-{formatCurrency(value.discount)}</span></p>
        <p className="flex justify-between"><span className="text-[var(--muted)]">Loyalty Discount</span><span>-{formatCurrency(value.loyaltyDiscount)}</span></p>
        <p className="flex justify-between"><span className="text-[var(--muted)]">CGST (9%)</span><span>{formatCurrency(value.cgst)}</span></p>
        <p className="flex justify-between"><span className="text-[var(--muted)]">SGST (9%)</span><span>{formatCurrency(value.sgst)}</span></p>
      </div>

      <div className="border-t border-dashed border-[var(--border)] pt-2">
        <p className="flex justify-between text-base font-bold text-[var(--foreground)]">
          <span>Total</span>
          <span>{formatCurrency(value.total)}</span>
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Payment Method</p>
        <div className="grid grid-cols-3 gap-2">
          {methods.map((method) => (
            <button
              key={method.value}
              type="button"
              onClick={() => onPaymentMethodChange(method.value)}
              className={[
                "h-9 rounded-lg border text-xs font-semibold",
                value.paymentMethod === method.value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-[var(--border)] text-slate-700",
              ].join(" ")}
            >
              {method.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Discount</p>
        <div className="mb-2 inline-flex rounded-lg border border-[var(--border)] p-1">
          <button
            type="button"
            onClick={() => onDiscountTypeChange("PERCENT")}
            className={[
              "rounded-md px-2 py-1 text-xs font-semibold",
              value.discountType === "PERCENT" ? "bg-slate-900 text-white" : "text-slate-700",
            ].join(" ")}
          >
            %
          </button>
          <button
            type="button"
            onClick={() => onDiscountTypeChange("FLAT")}
            className={[
              "rounded-md px-2 py-1 text-xs font-semibold",
              value.discountType === "FLAT" ? "bg-slate-900 text-white" : "text-slate-700",
            ].join(" ")}
          >
            Flat
          </button>
        </div>
        <input
          type="number"
          min="0"
          value={value.discountValue}
          onChange={(event) => onDiscountValueChange(Number(event.target.value) || 0)}
          className="h-9 w-full rounded-lg border border-[var(--border)] px-3 text-sm"
        />
      </div>

      <div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={value.useLoyaltyPoints}
            onChange={(event) => onLoyaltyToggle(event.target.checked)}
            className="h-4 w-4"
          />
          Use loyalty points ({value.loyaltyPointsAvailable} available)
        </label>

        {value.useLoyaltyPoints ? (
          <div className="mt-2">
            <input
              type="number"
              min="0"
              max={value.loyaltyPointsAvailable}
              value={value.loyaltyPointsToRedeem}
              onChange={(event) => onLoyaltyPointsChange(Number(event.target.value) || 0)}
              className="h-9 w-full rounded-lg border border-[var(--border)] px-3 text-sm"
            />
            <p className="mt-1 text-xs text-[var(--muted)]">= {formatCurrency(value.loyaltyDiscount)} discount</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
