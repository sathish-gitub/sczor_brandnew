import { Trash2 } from "lucide-react";

export type POSCartItem = {
  serviceId: string;
  name: string;
  price: number;
  duration: number;
  quantity: number;
  staffId: string;
  staffName: string;
};

export type POSStaffOption = {
  id: string;
  name: string;
};

type POSCartProps = {
  items: POSCartItem[];
  staffOptions: POSStaffOption[];
  onIncrease: (serviceId: string) => void;
  onDecrease: (serviceId: string) => void;
  onRemove: (serviceId: string) => void;
  onStaffChange: (serviceId: string, staffId: string) => void;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function POSCart({
  items,
  staffOptions,
  onIncrease,
  onDecrease,
  onRemove,
  onStaffChange,
}: POSCartProps) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Cart</h2>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">No services in cart yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div key={item.serviceId} className="rounded-lg border border-[var(--border)] p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{item.name}</p>
                  <p className="text-xs text-[var(--muted)]">{item.duration} min</p>
                </div>

                <button
                  type="button"
                  onClick={() => onRemove(item.serviceId)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-3">
                <label className="text-xs font-medium text-[var(--muted)]">Service by</label>
                <select
                  value={item.staffId}
                  onChange={(event) => onStaffChange(item.serviceId, event.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-[var(--border)] bg-white px-2 text-sm"
                >
                  <option value="">Select staff</option>
                  {staffOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="inline-flex items-center overflow-hidden rounded-md border border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => onDecrease(item.serviceId)}
                    className="h-8 w-8 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    -
                  </button>
                  <span className="inline-flex h-8 min-w-8 items-center justify-center border-x border-[var(--border)] px-2 text-xs font-semibold text-slate-800">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => onIncrease(item.serviceId)}
                    className="h-8 w-8 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    +
                  </button>
                </div>

                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {formatCurrency(item.price * item.quantity)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
