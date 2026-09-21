"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

type SupplierOption = {
  id: string;
  name: string;
};

type ProductOption = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  costPrice: number;
};

type LineItem = {
  productId: string;
  quantity: string;
  unitCost: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillProductId = searchParams.get("productId");
  const prefillSupplierId = searchParams.get("supplierId");

  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ productId: "", quantity: "1", unitCost: "0" }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadOptions() {
      const [suppliersResponse, productsResponse] = await Promise.all([
        fetch("/api/inventory/suppliers", { cache: "no-store" }),
        fetch("/api/inventory/products", { cache: "no-store" }),
      ]);

      const suppliersPayload = (await suppliersResponse.json().catch(() => null)) as
        | { items?: SupplierOption[] }
        | null;
      const productsPayload = (await productsResponse.json().catch(() => null)) as
        | { items?: Array<{ id: string; name: string; sku: string | null; unit: string; costPrice: number }> }
        | null;

      if (!active) {
        return;
      }

      setSuppliers(suppliersPayload?.items ?? []);
      const loadedProducts = (productsPayload?.items ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        costPrice: item.costPrice,
      }));
      setProducts(loadedProducts);

      if (prefillProductId) {
        const match = loadedProducts.find((product) => product.id === prefillProductId);

        if (match) {
          setItems([{ productId: match.id, quantity: "1", unitCost: String(match.costPrice) }]);
        }
      }

      if (prefillSupplierId) {
        setSupplierId(prefillSupplierId);
      }
    }

    loadOptions();

    return () => {
      active = false;
    };
  }, [prefillProductId, prefillSupplierId]);

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function selectProduct(index: number, productId: string) {
    const product = productMap.get(productId);
    updateItem(index, {
      productId,
      unitCost: product ? String(product.costPrice) : "0",
    });
  }

  function addLine() {
    setItems((current) => [...current, { productId: "", quantity: "1", unitCost: "0" }]);
  }

  function removeLine(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  const lineAmounts = items.map((item) => roundMoney(Number(item.quantity || 0) * Number(item.unitCost || 0)));
  const total = roundMoney(lineAmounts.reduce((sum, amount) => sum + amount, 0));

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!supplierId) {
      setError("Select a supplier.");
      return;
    }

    const validItems = items.filter((item) => item.productId && Number(item.quantity) > 0);

    if (validItems.length === 0) {
      setError("Add at least one line item with a product and quantity.");
      return;
    }

    setSubmitting(true);

    const response = await fetch("/api/inventory/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId,
        notes,
        items: validItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitCost: item.unitCost,
        })),
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; purchaseOrder?: { id: string } }
      | null;

    if (!response.ok || !payload?.purchaseOrder) {
      setError(payload?.error ?? "Unable to create purchase order.");
      setSubmitting(false);
      return;
    }

    router.push(`/inventory/purchase-orders/${payload.purchaseOrder.id}`);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">New Purchase Order</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Order products from a supplier. Stock updates only after it&apos;s marked Received.</p>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-5">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-[var(--foreground)]">Supplier</span>
          <select
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
            required
            className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
          >
            <option value="">Select supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--foreground)]">Line Items</span>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Line
            </button>
          </div>

          {items.map((item, index) => (
            <div key={index} className="grid gap-2 rounded-xl border border-[var(--border)] p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
              <select
                value={item.productId}
                onChange={(event) => selectProduct(index, event.target.value)}
                className="h-10 w-full rounded-lg border border-[var(--border)] px-2 text-sm"
              >
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} {product.sku ? `(${product.sku})` : ""}
                  </option>
                ))}
              </select>

              <input
                value={item.quantity}
                onChange={(event) => updateItem(index, { quantity: event.target.value })}
                type="number"
                min="0"
                step="0.01"
                placeholder="Qty"
                className="h-10 w-full rounded-lg border border-[var(--border)] px-2 text-sm"
              />

              <input
                value={item.unitCost}
                onChange={(event) => updateItem(index, { unitCost: event.target.value })}
                type="number"
                min="0"
                step="0.01"
                placeholder="Unit Cost"
                className="h-10 w-full rounded-lg border border-[var(--border)] px-2 text-sm"
              />

              <div className="flex h-10 items-center rounded-lg bg-slate-50 px-2 text-sm font-semibold text-[var(--foreground)]">
                {formatCurrency(lineAmounts[index] || 0)}
              </div>

              <button
                type="button"
                onClick={() => removeLine(index)}
                disabled={items.length === 1}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Total</p>
            <p className="text-lg font-bold text-[var(--foreground)]">{formatCurrency(total)}</p>
          </div>
        </div>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-[var(--foreground)]">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="w-full rounded-xl border border-[var(--border)] px-3 py-2"
          />
        </label>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)] disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Create Purchase Order"}
          </button>

          <Link
            href="/inventory/purchase-orders"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
