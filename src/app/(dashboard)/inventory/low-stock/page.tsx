"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ShoppingCart } from "lucide-react";

type LowStockItem = {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  reorderLevel: number;
  category: string | null;
  supplier: string | null;
};

function severity(item: LowStockItem) {
  if (item.currentStock <= 0) {
    return { label: "Out of Stock", className: "bg-red-100 text-red-700" };
  }

  if (item.reorderLevel > 0 && item.currentStock <= item.reorderLevel / 2) {
    return { label: "Critical", className: "bg-red-100 text-red-700" };
  }

  return { label: "Low", className: "bg-amber-100 text-amber-700" };
}

export default function LowStockPage() {
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/dashboard/low-stock?limit=1000", { cache: "no-store" });
        const payload = (await response.json()) as { error?: string; items?: LowStockItem[] };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load low stock products.");
        }

        if (!active) {
          return;
        }

        setItems(payload.items ?? []);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load low stock products.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      <Link
        href="/inventory"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Inventory
      </Link>

      <header>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Low Stock Products</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">All active products at or below their reorder level.</p>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-base font-semibold text-[var(--foreground)]">All stock levels healthy ✅</p>
            <p className="mt-1 text-sm text-[var(--muted)]">No products are at or below their reorder level.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-slate-50 text-xs uppercase tracking-[0.06em] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Current Stock</th>
                <th className="px-4 py-3">Reorder Level</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const level = severity(item);

                return (
                  <tr key={item.id} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                      <Link href={`/inventory/${item.id}`} className="hover:underline">
                        {item.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{item.category ?? "—"}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {item.currentStock} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {item.reorderLevel} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{item.supplier ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${level.className}`}>{level.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/inventory/purchase-orders/new?productId=${item.id}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Create PO
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
