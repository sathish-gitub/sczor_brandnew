"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { useAccess } from "@/contexts/AccessContext";

type PurchaseOrderItem = {
  id: string;
  poNumber: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  receivedAt: string | null;
  supplier: { id: string; name: string };
  itemCount: number;
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  RECEIVED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-slate-200 text-slate-700",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function PurchaseOrdersPage() {
  const access = useAccess();

  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("ALL");

  useEffect(() => {
    let active = true;

    async function loadOrders() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (status !== "ALL") {
          params.set("status", status);
        }

        const response = await fetch(`/api/inventory/purchase-orders?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as { error?: string; items?: PurchaseOrderItem[] };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load purchase orders.");
        }

        if (!active) {
          return;
        }

        setItems(payload.items ?? []);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load purchase orders.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadOrders();

    return () => {
      active = false;
    };
  }, [status]);

  const isReadOnly = access.accessLevel === "READ_ONLY";
  const rows = useMemo(() => items, [items]);

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
      ) : null}

      <header className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Purchase Orders</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Order stock from suppliers and receive it into inventory.</p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/inventory"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Inventory
            </Link>
            <Link
              href={isReadOnly ? "#" : "/inventory/purchase-orders/new"}
              aria-disabled={isReadOnly}
              onClick={(event) => {
                if (isReadOnly) {
                  event.preventDefault();
                }
              }}
              className={
                isReadOnly
                  ? "inline-flex h-10 cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-300 px-4 text-sm font-semibold text-slate-500"
                  : "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)]"
              }
            >
              <Plus className="h-4 w-4" />
              New Purchase Order
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {["ALL", "PENDING", "RECEIVED", "CANCELLED"].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setStatus(option)}
              className={[
                "rounded-full px-3 py-1.5 text-sm font-semibold",
                status === option ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
              ].join(" ")}
            >
              {option === "ALL" ? "All" : option.charAt(0) + option.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-base font-semibold text-[var(--foreground)]">No purchase orders found.</p>
            <Link
              href="/inventory/purchase-orders/new"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)]"
            >
              Create Your First Purchase Order
            </Link>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-slate-50 text-xs uppercase tracking-[0.06em] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">PO Number</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Total Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => (
                <tr key={order.id} className="border-b border-[var(--border)] last:border-b-0">
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">{order.poNumber}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{order.supplier.name}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{formatCurrency(order.totalAmount)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[order.status] ?? STATUS_STYLES.PENDING}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{formatDate(order.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/inventory/purchase-orders/${order.id}`}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
