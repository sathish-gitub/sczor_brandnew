"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { useAccess } from "@/contexts/AccessContext";
import { useToast } from "@/components/ui/Toast";

type SupplierItem = {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  productCount: number;
};

export default function SuppliersPage() {
  const access = useAccess();
  const { showToast } = useToast();

  const [items, setItems] = useState<SupplierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSuppliers() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (search.trim()) {
          params.set("search", search.trim());
        }

        const response = await fetch(`/api/inventory/suppliers?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as { error?: string; items?: SupplierItem[] };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load suppliers.");
        }

        if (!active) {
          return;
        }

        setItems(payload.items ?? []);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load suppliers.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    const timeout = setTimeout(loadSuppliers, 250);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [search]);

  async function removeSupplier(id: string) {
    const allowed = window.confirm("Delete this supplier? This action cannot be undone.");

    if (!allowed) {
      return;
    }

    setBusyId(id);

    const response = await fetch(`/api/inventory/suppliers/${id}`, { method: "DELETE" });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      showToast({ variant: "error", title: "Unable to delete supplier", message: payload?.error });
      setBusyId(null);
      return;
    }

    setItems((prev) => prev.filter((item) => item.id !== id));
    showToast({ variant: "success", title: "Supplier deleted" });
    setBusyId(null);
  }

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
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Suppliers</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Manage vendors that supply your inventory products.</p>
          </div>

          <Link
            href={isReadOnly ? "#" : "/inventory/suppliers/new"}
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
            Add Supplier
          </Link>
        </div>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name..."
          className="h-10 w-full max-w-sm rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
        />
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
            <p className="text-base font-semibold text-[var(--foreground)]">No suppliers found.</p>
            <Link
              href="/inventory/suppliers/new"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)]"
            >
              Add Your First Supplier
            </Link>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-slate-50 text-xs uppercase tracking-[0.06em] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact Person</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Products</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((supplier) => (
                <tr key={supplier.id} className="border-b border-[var(--border)] last:border-b-0">
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">{supplier.name}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{supplier.contactPerson || "—"}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{supplier.phone || "—"}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{supplier.email || "—"}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{supplier.productCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/inventory/suppliers/${supplier.id}/edit`}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeSupplier(supplier.id)}
                        disabled={busyId === supplier.id}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
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
