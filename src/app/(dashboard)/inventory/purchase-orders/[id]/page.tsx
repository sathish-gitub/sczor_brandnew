"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { useAccess } from "@/contexts/AccessContext";
import { useToast } from "@/components/ui/Toast";

type PurchaseOrderPayload = {
  id: string;
  poNumber: string;
  status: string;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  receivedAt: string | null;
  supplier: { id: string; name: string; phone: string | null; email: string | null };
  items: Array<{
    id: string;
    quantity: number;
    unitCost: number;
    amount: number;
    product: { id: string; name: string; unit: string; sku: string | null };
  }>;
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

export default function PurchaseOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const access = useAccess();
  const { showToast } = useToast();

  const [order, setOrder] = useState<PurchaseOrderPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadOrder() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/inventory/purchase-orders/${params.id}`, { cache: "no-store" });
        const payload = (await response.json()) as { error?: string; purchaseOrder?: PurchaseOrderPayload };

        if (!response.ok || !payload.purchaseOrder) {
          throw new Error(payload.error ?? "Unable to load purchase order.");
        }

        if (!active) {
          return;
        }

        setOrder(payload.purchaseOrder);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load purchase order.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadOrder();

    return () => {
      active = false;
    };
  }, [params.id, refreshKey]);

  async function markAsReceived() {
    const allowed = window.confirm("Mark this purchase order as received? This will increase stock for all line items.");

    if (!allowed) {
      return;
    }

    setActionBusy(true);

    const response = await fetch(`/api/inventory/purchase-orders/${params.id}/receive`, { method: "POST" });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    setActionBusy(false);

    if (!response.ok) {
      showToast({ variant: "error", title: "Unable to receive order", message: payload?.error });
      return;
    }

    showToast({ variant: "success", title: "Purchase order received", message: "Stock levels have been updated." });
    setRefreshKey((key) => key + 1);
    router.refresh();
  }

  async function cancelOrder() {
    const allowed = window.confirm("Cancel this purchase order? This cannot be undone.");

    if (!allowed) {
      return;
    }

    setActionBusy(true);

    const response = await fetch(`/api/inventory/purchase-orders/${params.id}/cancel`, { method: "POST" });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    setActionBusy(false);

    if (!response.ok) {
      showToast({ variant: "error", title: "Unable to cancel order", message: payload?.error });
      return;
    }

    showToast({ variant: "success", title: "Purchase order cancelled" });
    setRefreshKey((key) => key + 1);
  }

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl border border-[var(--border)] bg-white" />;
  }

  if (error || !order) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
        {error ?? "Purchase order not found."}
      </div>
    );
  }

  const isReadOnly = access.accessLevel === "READ_ONLY";
  const isPending = order.status === "PENDING";

  return (
    <div className="space-y-5">
      <Link
        href="/inventory/purchase-orders"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Purchase Orders
      </Link>

      <header className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">{order.poNumber}</h1>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[order.status] ?? STATUS_STYLES.PENDING}`}>
                {order.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Supplier: {order.supplier.name} • Created {formatDate(order.createdAt)}
              {order.receivedAt ? ` • Received ${formatDate(order.receivedAt)}` : ""}
            </p>
          </div>

          {isPending ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelOrder}
                disabled={actionBusy || isReadOnly}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Cancel Order
              </button>
              <button
                type="button"
                onClick={markAsReceived}
                disabled={actionBusy || isReadOnly}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)] disabled:opacity-50"
              >
                Mark as Received
              </button>
            </div>
          ) : null}
        </div>

        {order.notes ? <p className="mt-3 text-sm text-[var(--muted)]">Notes: {order.notes}</p> : null}
      </header>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Line Items</h2>

        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-slate-50 text-xs uppercase tracking-[0.06em] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Unit Cost</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-[var(--border)] last:border-b-0">
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                    {item.product.name} {item.product.sku ? <span className="text-xs text-[var(--muted)]">({item.product.sku})</span> : null}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {item.quantity} {item.product.unit}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{formatCurrency(item.unitCost)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[var(--foreground)]">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-[var(--foreground)]">
                  Total
                </td>
                <td className="px-4 py-3 text-right text-base font-bold text-[var(--foreground)]">{formatCurrency(order.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
