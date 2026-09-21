"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Package, Plus, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAccess } from "@/contexts/AccessContext";
import { ProductCard } from "@/components/inventory/ProductCard";
import { useToast } from "@/components/ui/Toast";

type ProductItem = {
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

type CategoryOption = {
  id: string;
  name: string;
};

function bannerFor(value: string | null) {
  if (value === "created") {
    return "Product created successfully.";
  }

  if (value === "updated") {
    return "Product updated successfully.";
  }

  return null;
}

export default function InventoryPage() {
  const access = useAccess();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const [items, setItems] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState("ALL");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCategories() {
      const response = await fetch("/api/inventory/categories", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { items?: CategoryOption[] } | null;

      if (!active || !response.ok) {
        return;
      }

      setCategories(payload?.items ?? []);
    }

    loadCategories();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (categoryId !== "ALL") {
          params.set("categoryId", categoryId);
        }
        if (search.trim()) {
          params.set("search", search.trim());
        }

        const response = await fetch(`/api/inventory/products?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as { error?: string; items?: ProductItem[] };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load products.");
        }

        if (!active) {
          return;
        }

        setItems(payload.items ?? []);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load products.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    const timeout = setTimeout(loadProducts, 200);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [categoryId, search]);

  async function removeProduct(id: string) {
    const allowed = window.confirm("Delete this product? This action cannot be undone.");

    if (!allowed) {
      return;
    }

    setBusyId(id);

    const response = await fetch(`/api/inventory/products/${id}`, { method: "DELETE" });
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; softDeleted?: boolean; message?: string }
      | null;

    if (!response.ok) {
      showToast({ variant: "error", title: "Unable to delete product", message: payload?.error });
      setBusyId(null);
      return;
    }

    if (payload?.softDeleted) {
      showToast({ variant: "success", title: "Product marked inactive", message: payload.message });
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: "INACTIVE" } : item)));
    } else {
      showToast({ variant: "success", title: "Product deleted" });
      setItems((prev) => prev.filter((item) => item.id !== id));
    }

    setBusyId(null);
  }

  const successMessage = useMemo(() => bannerFor(searchParams.get("success")), [searchParams]);
  const isReadOnly = access.accessLevel === "READ_ONLY";

  return (
    <div className="space-y-5">
      {successMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
      ) : null}

      <header className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Inventory</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Track products, stock levels, and reorder alerts.</p>
          </div>

          <Link
            href={isReadOnly ? "#" : "/inventory/new"}
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
            Add Product
          </Link>
        </div>

        <nav className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] pb-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white">
            <Package className="h-3.5 w-3.5" />
            Products
          </span>
          <Link
            href="/inventory/suppliers"
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            <Truck className="h-3.5 w-3.5" />
            Suppliers
          </Link>
          <Link
            href="/inventory/purchase-orders"
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            Purchase Orders
          </Link>
          <Link
            href="/inventory/low-stock"
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            Low Stock
          </Link>
          <Link
            href="/reports/inventory"
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            Reports
          </Link>
        </nav>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm"
          >
            <option value="ALL">All Categories</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or SKU..."
            className="h-10 w-full max-w-sm rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>
      </header>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-56 animate-pulse rounded-2xl border border-[var(--border)] bg-white" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-16 text-center">
          <p className="text-base font-semibold text-[var(--foreground)]">No products found.</p>
          <Link
            href="/inventory/new"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)]"
          >
            Add Your First Product
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((product) => (
            <ProductCard key={product.id} product={product} onDelete={removeProduct} busy={busyId === product.id} />
          ))}
        </div>
      )}
    </div>
  );
}
