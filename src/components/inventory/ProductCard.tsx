import { Edit3, Eye, Trash2 } from "lucide-react";
import Link from "next/link";

type ProductCardProps = {
  product: {
    id: string;
    name: string;
    sku: string | null;
    unit: string;
    sellingPrice: number;
    currentStock: number;
    reorderLevel: number;
    status: "ACTIVE" | "INACTIVE";
    category: { id: string; name: string } | null;
  };
  onDelete: (id: string) => void;
  busy: boolean;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function ProductCard({ product, onDelete, busy }: ProductCardProps) {
  const isLowStock = product.currentStock <= product.reorderLevel;

  return (
    <article className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-medium text-[var(--foreground)]">{product.name}</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">{product.sku ? `SKU: ${product.sku}` : "No SKU"}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {product.category?.name ?? "Uncategorized"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Stock</p>
          <p className="mt-1 flex items-center gap-1.5 font-semibold text-[var(--foreground)]">
            {isLowStock ? (
              <span
                className={`h-2 w-2 rounded-full ${product.currentStock <= 0 ? "bg-red-500" : "bg-amber-500"}`}
                title="Low stock"
              />
            ) : null}
            {product.currentStock} {product.unit}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Selling Price</p>
          <p className="mt-1 font-semibold text-[var(--foreground)]">{formatCurrency(product.sellingPrice)}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span
          className={[
            "rounded-full px-2.5 py-1 text-xs font-semibold",
            product.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700",
          ].join(" ")}
        >
          {product.status}
        </span>

        <div className="flex items-center gap-2">
          <Link
            href={`/inventory/${product.id}`}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Eye className="h-3.5 w-3.5" />
            View
          </Link>

          <Link
            href={`/inventory/${product.id}/edit`}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit
          </Link>

          <button
            type="button"
            onClick={() => onDelete(product.id)}
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
