"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, PackagePlus } from "lucide-react";

import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAccess } from "@/contexts/AccessContext";

type ProductPayload = {
  id: string;
  name: string;
  sku: string | null;
  brand: string | null;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  currentStock: number;
  reorderLevel: number;
  isRetailItem: boolean;
  status: "ACTIVE" | "INACTIVE";
  category: { id: string; name: string } | null;
  supplier: { id: string; name: string } | null;
};

type MovementPayload = {
  id: string;
  type: string;
  quantity: number;
  reason: string | null;
  reference: string | null;
  createdAt: string;
};

const MOVEMENT_LABELS: Record<string, string> = {
  PURCHASE_IN: "Purchase In",
  SALE_OUT: "Sale Out",
  MANUAL_ADJUST_IN: "Stock In",
  MANUAL_ADJUST_OUT: "Stock Out",
  WASTAGE: "Wastage",
};

const OUTGOING_TYPES = new Set(["SALE_OUT", "MANUAL_ADJUST_OUT", "WASTAGE"]);

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const access = useAccess();
  const { showToast } = useToast();

  const [product, setProduct] = useState<ProductPayload | null>(null);
  const [movements, setMovements] = useState<MovementPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustType, setAdjustType] = useState<"STOCK_IN" | "STOCK_OUT" | "WASTAGE">("STOCK_IN");
  const [adjustQuantity, setAdjustQuantity] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const [productResponse, movementsResponse] = await Promise.all([
          fetch(`/api/inventory/products/${params.id}`, { cache: "no-store" }),
          fetch(`/api/inventory/products/${params.id}/stock-movements`, { cache: "no-store" }),
        ]);

        const productPayload = (await productResponse.json()) as { error?: string; product?: ProductPayload };
        const movementsPayload = (await movementsResponse.json()) as { error?: string; items?: MovementPayload[] };

        if (!productResponse.ok || !productPayload.product) {
          throw new Error(productPayload.error ?? "Unable to load product.");
        }

        if (!active) {
          return;
        }

        setProduct(productPayload.product);
        setMovements(movementsPayload.items ?? []);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load product.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [params.id, refreshKey]);

  function openAdjustModal() {
    setAdjustType("STOCK_IN");
    setAdjustQuantity("");
    setAdjustReason("");
    setAdjustError(null);
    setShowAdjustModal(true);
  }

  async function submitAdjustment() {
    setAdjustError(null);

    const quantity = Number(adjustQuantity);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setAdjustError("Enter a quantity greater than zero.");
      return;
    }

    if (adjustType === "WASTAGE" && !adjustReason.trim()) {
      setAdjustError("Reason is required for wastage.");
      return;
    }

    setSubmitting(true);

    const response = await fetch(`/api/inventory/products/${params.id}/adjust-stock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: adjustType, quantity: adjustQuantity, reason: adjustReason }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    setSubmitting(false);

    if (!response.ok) {
      setAdjustError(payload?.error ?? "Unable to adjust stock.");
      return;
    }

    showToast({ variant: "success", title: "Stock updated" });
    setShowAdjustModal(false);
    setRefreshKey((key) => key + 1);
  }

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl border border-[var(--border)] bg-white" />;
  }

  if (error || !product) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
        {error ?? "Product not found."}
      </div>
    );
  }

  const isLowStock = product.currentStock <= product.reorderLevel;
  const isReadOnly = access.accessLevel === "READ_ONLY";

  return (
    <div className="space-y-5">
      <Link href="/inventory" className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]">
        <ArrowLeft className="h-4 w-4" />
        Back to Inventory
      </Link>

      <header className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">{product.name}</h1>
              <span
                className={[
                  "rounded-full px-2.5 py-1 text-xs font-semibold",
                  product.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700",
                ].join(" ")}
              >
                {product.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {product.category?.name ?? "Uncategorized"} {product.brand ? `• ${product.brand}` : ""}{" "}
              {product.sku ? `• SKU: ${product.sku}` : ""}
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href={`/inventory/${product.id}/edit`}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Edit Product
            </Link>
            <button
              type="button"
              onClick={openAdjustModal}
              disabled={isReadOnly}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)] disabled:opacity-50"
            >
              <PackagePlus className="h-4 w-4" />
              Adjust Stock
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Current Stock</p>
            <p className="mt-1 flex items-center gap-1.5 text-lg font-semibold text-[var(--foreground)]">
              {isLowStock ? (
                <span className={`h-2.5 w-2.5 rounded-full ${product.currentStock <= 0 ? "bg-red-500" : "bg-amber-500"}`} />
              ) : null}
              {product.currentStock} {product.unit}
            </p>
            {isLowStock ? <p className="mt-1 text-xs font-medium text-amber-600">Low stock — reorder soon.</p> : null}
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Reorder Level</p>
            <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">
              {product.reorderLevel} {product.unit}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Cost Price</p>
            <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">{formatCurrency(product.costPrice)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Selling Price</p>
            <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">{formatCurrency(product.sellingPrice)}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-sm text-[var(--muted)]">
          <span>Supplier: {product.supplier?.name ?? "—"}</span>
          <span>•</span>
          <span>POS Retail Item: {product.isRetailItem ? "Yes" : "No"}</span>
        </div>
      </header>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Stock Movement History</h2>

        {movements.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">No stock movements recorded yet.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-slate-50 text-xs uppercase tracking-[0.06em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Reference</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {new Date(movement.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-xs font-semibold",
                          OUTGOING_TYPES.has(movement.type) ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700",
                        ].join(" ")}
                      >
                        {MOVEMENT_LABELS[movement.type] ?? movement.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                      {OUTGOING_TYPES.has(movement.type) ? "-" : "+"}
                      {movement.quantity} {product.unit}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{movement.reason || "—"}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{movement.reference || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={showAdjustModal} onClose={() => setShowAdjustModal(false)} title="Adjust Stock" size="sm">
        <div className="space-y-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Type</span>
            <select
              value={adjustType}
              onChange={(event) => setAdjustType(event.target.value as "STOCK_IN" | "STOCK_OUT" | "WASTAGE")}
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3 text-sm"
            >
              <option value="STOCK_IN">Stock In</option>
              <option value="STOCK_OUT">Stock Out</option>
              <option value="WASTAGE">Wastage</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Quantity ({product.unit})</span>
            <input
              value={adjustQuantity}
              onChange={(event) => setAdjustQuantity(event.target.value)}
              type="number"
              min="0"
              step="0.01"
              autoFocus
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">
              Reason {adjustType === "WASTAGE" ? "(required)" : "(optional)"}
            </span>
            <textarea
              value={adjustReason}
              onChange={(event) => setAdjustReason(event.target.value)}
              rows={2}
              className="w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>

          {adjustError ? <p className="text-sm text-red-600">{adjustError}</p> : null}

          <button
            type="button"
            onClick={submitAdjustment}
            disabled={submitting}
            className="h-10 w-full rounded-xl bg-[var(--primary)] text-sm font-semibold text-white hover:bg-[var(--accent)] disabled:opacity-70"
          >
            {submitting ? "Saving..." : "Save Adjustment"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
