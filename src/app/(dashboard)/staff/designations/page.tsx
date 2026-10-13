"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";

type StaffDesignationRow = {
  id: string;
  name: string;
};

export default function ManageDesignationsPage() {
  const [items, setItems] = useState<StaffDesignationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/staff/designations", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as { error?: string; items?: StaffDesignationRow[] } | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? "Unable to load designations.");
        }

        if (!active) {
          return;
        }

        setItems(payload?.items ?? []);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load designations.");
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

  async function removeDesignation(id: string) {
    setDeletingId(id);
    setError(null);

    try {
      const response = await fetch(`/api/staff/designations/${id}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to delete designation.");
      }

      setItems((current) => current.filter((item) => item.id !== id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete designation.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="space-y-2">
        <Link href="/staff" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to Staff
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Manage Designations</h1>
        <p className="text-sm text-[var(--muted)]">
          Designations used on staff profiles. A designation can only be deleted once no staff member uses it.
        </p>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="rounded-2xl border border-[var(--border)] bg-white p-2">
        {loading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-[var(--muted)]">No designations yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm font-medium text-[var(--foreground)]">{item.name}</span>
                <button
                  type="button"
                  onClick={() => void removeDesignation(item.id)}
                  disabled={deletingId === item.id}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50"
                  aria-label={`Delete ${item.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
