"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ProductCategorySelect } from "@/components/inventory/ProductCategorySelect";
import { SupplierSelect } from "@/components/inventory/SupplierSelect";

const UNIT_OPTIONS = ["pcs", "ml", "g", "l", "kg"];

type ProductPayload = {
  id: string;
  name: string;
  sku: string | null;
  categoryId: string | null;
  brand: string | null;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  currentStock: number;
  reorderLevel: number;
  isRetailItem: boolean;
  supplierId: string | null;
  status: "ACTIVE" | "INACTIVE";
};

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brand, setBrand] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [costPrice, setCostPrice] = useState("0");
  const [sellingPrice, setSellingPrice] = useState("0");
  const [currentStock, setCurrentStock] = useState(0);
  const [reorderLevel, setReorderLevel] = useState("0");
  const [isRetailItem, setIsRetailItem] = useState(true);
  const [supplierId, setSupplierId] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");

  useEffect(() => {
    let active = true;

    async function loadProduct() {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/inventory/products/${params.id}`, { cache: "no-store" });
      const payload = (await response.json()) as { error?: string; product?: ProductPayload };

      if (!response.ok || !payload.product) {
        if (active) {
          setError(payload.error ?? "Unable to load product.");
          setLoading(false);
        }
        return;
      }

      if (!active) {
        return;
      }

      const product = payload.product;
      setName(product.name);
      setSku(product.sku || "");
      setCategoryId(product.categoryId || "");
      setBrand(product.brand || "");
      setUnit(product.unit);
      setCostPrice(String(product.costPrice));
      setSellingPrice(String(product.sellingPrice));
      setCurrentStock(product.currentStock);
      setReorderLevel(String(product.reorderLevel));
      setIsRetailItem(product.isRetailItem);
      setSupplierId(product.supplierId || "");
      setStatus(product.status);
      setLoading(false);
    }

    loadProduct();

    return () => {
      active = false;
    };
  }, [params.id]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/inventory/products/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        sku,
        categoryId,
        brand,
        unit,
        costPrice,
        sellingPrice,
        reorderLevel,
        isRetailItem,
        supplierId,
        status,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setError(payload?.error ?? "Unable to update product.");
      setSubmitting(false);
      return;
    }

    router.push("/inventory?success=updated");
    router.refresh();
  }

  if (loading) {
    return <div className="h-56 animate-pulse rounded-2xl border border-[var(--border)] bg-white" />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Edit {name}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Update product details. Use &quot;Adjust Stock&quot; on the product page to change stock.</p>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Product Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">SKU</span>
            <input
              value={sku}
              onChange={(event) => setSku(event.target.value)}
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Category</span>
            <ProductCategorySelect value={categoryId} onChange={setCategoryId} />
          </div>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Brand</span>
            <input
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Unit</span>
            <select
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            >
              {UNIT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Cost Price (INR)</span>
            <input
              value={costPrice}
              onChange={(event) => setCostPrice(event.target.value)}
              type="number"
              min="0"
              step="0.01"
              required
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Selling Price (INR)</span>
            <input
              value={sellingPrice}
              onChange={(event) => setSellingPrice(event.target.value)}
              type="number"
              min="0"
              step="0.01"
              required
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Current Stock</span>
            <input
              value={`${currentStock} ${unit}`}
              disabled
              readOnly
              className="h-10 w-full rounded-xl border border-[var(--border)] bg-slate-50 px-3 text-slate-500"
            />
            <span className="text-xs text-[var(--muted)]">Use &quot;Adjust Stock&quot; on the product page to change this.</span>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Reorder Level</span>
            <input
              value={reorderLevel}
              onChange={(event) => setReorderLevel(event.target.value)}
              type="number"
              min="0"
              step="0.01"
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as "ACTIVE" | "INACTIVE")}
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </label>
        </div>

        <div className="space-y-1 text-sm">
          <span className="font-medium text-[var(--foreground)]">Supplier</span>
          <SupplierSelect value={supplierId} onChange={setSupplierId} />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isRetailItem}
            onChange={(event) => setIsRetailItem(event.target.checked)}
            className="h-4 w-4 rounded border-[var(--border)]"
          />
          <span className="font-medium text-[var(--foreground)]">Available for sale to customers via POS</span>
        </label>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)] disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </button>

          <Link
            href="/inventory"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
