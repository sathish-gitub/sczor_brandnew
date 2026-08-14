import { Edit3, Power, Trash2 } from "lucide-react";
import Link from "next/link";

type ServiceCardProps = {
  service: {
    id: string;
    name: string;
    category: string;
    description: string | null;
    price: number;
    duration: number;
    status: "ACTIVE" | "INACTIVE";
  };
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  busy: boolean;
};

const categoryClasses: Record<string, string> = {
  Hair: "bg-sky-100 text-sky-700",
  Skin: "bg-emerald-100 text-emerald-700",
  Nail: "bg-fuchsia-100 text-fuchsia-700",
  Makeup: "bg-rose-100 text-rose-700",
  Spa: "bg-amber-100 text-amber-700",
  Other: "bg-slate-100 text-slate-700",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function ServiceCard({ service, onToggle, onDelete, busy }: ServiceCardProps) {
  return (
    <article className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">{service.name}</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">{service.description || "No description added yet."}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${categoryClasses[service.category] || categoryClasses.Other}`}>
          {service.category}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Price</p>
          <p className="mt-1 font-semibold text-[var(--foreground)]">{formatCurrency(service.price)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Duration</p>
          <p className="mt-1 font-semibold text-[var(--foreground)]">{service.duration} min</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span
          className={[
            "rounded-full px-2.5 py-1 text-xs font-semibold",
            service.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700",
          ].join(" ")}
        >
          {service.status}
        </span>

        <div className="flex items-center gap-2">
          <Link
            href={`/services/${service.id}/edit`}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit
          </Link>

          <button
            type="button"
            onClick={() => onToggle(service.id)}
            disabled={busy}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Power className="h-3.5 w-3.5" />
            {service.status === "ACTIVE" ? "Disable" : "Enable"}
          </button>

          <button
            type="button"
            onClick={() => onDelete(service.id)}
            disabled={busy}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}
