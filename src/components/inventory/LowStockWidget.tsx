"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, PackageCheck } from "lucide-react";

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

export function LowStockWidget() {
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      const response = await fetch("/api/dashboard/low-stock?limit=6", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | { items?: LowStockItem[]; totalCount?: number }
        | null;

      if (!active || !response.ok) {
        setLoading(false);
        return;
      }

      setItems(payload?.items ?? []);
      setTotalCount(payload?.totalCount ?? 0);
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="rounded-xl border border-[var(--border)] bg-white">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
        <h2 className="text-base font-semibold text-[var(--foreground)]">Low Stock Alerts</h2>
        {totalCount > items.length ? (
          <Link href="/inventory/low-stock" className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--primary)]">
            View All
          </Link>
        ) : null}
      </div>

      <div className="p-4">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-14 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <PackageCheck className="h-8 w-8 text-emerald-500" />
            <p className="text-sm font-medium text-[var(--foreground)]">All stock levels healthy ✅</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const level = severity(item);

              return (
                <Link
                  key={item.id}
                  href={`/inventory/${item.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--foreground)]">{item.name}</p>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {item.currentStock} {item.unit} left (reorder at {item.reorderLevel} {item.unit})
                    </p>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${level.className}`}>
                    <AlertTriangle className="h-3 w-3" />
                    {level.label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {totalCount > items.length ? (
          <p className="mt-3 text-center text-xs text-[var(--muted)]">and {totalCount - items.length} more</p>
        ) : null}
      </div>
    </section>
  );
}
