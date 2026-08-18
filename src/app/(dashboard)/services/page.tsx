"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LayoutGrid, List, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ServiceCard } from "@/components/services/ServiceCard";

type ServiceItem = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  duration: number;
  status: "ACTIVE" | "INACTIVE";
};

const categoryOptions = ["ALL", "Hair", "Skin", "Nail", "Makeup", "Spa", "Other"] as const;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function bannerFor(value: string | null) {
  if (value === "created") {
    return "Service created successfully.";
  }

  if (value === "updated") {
    return "Service updated successfully.";
  }

  return null;
}

export default function ServicesPage() {
  const searchParams = useSearchParams();

  const [items, setItems] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("ALL");
  const [categories, setCategories] = useState<string[]>([]);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCategories() {
      const response = await fetch("/api/services/categories", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | { items?: Array<{ id: string; name: string }> }
        | null;

      if (!active || !response.ok) {
        return;
      }

      setCategories((payload?.items ?? []).map((item) => item.name));
    }

    loadCategories();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadServices() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (category !== "ALL") {
          params.set("category", category);
        }

        const response = await fetch(`/api/services?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as { error?: string; items?: ServiceItem[] };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load services.");
        }

        if (!active) {
          return;
        }

        setItems(payload.items ?? []);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load services.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadServices();

    return () => {
      active = false;
    };
  }, [category]);

  async function toggleStatus(id: string) {
    setBusyId(id);
    setError(null);

    const response = await fetch(`/api/services/${id}/toggle`, {
      method: "PATCH",
    });

    const payload = (await response.json().catch(() => null)) as { error?: string; service?: ServiceItem } | null;

    if (!response.ok || !payload?.service) {
      setError(payload?.error ?? "Unable to update service status.");
      setBusyId(null);
      return;
    }

    setItems((prev) => prev.map((item) => (item.id === id ? payload.service! : item)));
    setBusyId(null);
  }

  async function removeService(id: string) {
    const allowed = window.confirm("Delete this service? This action cannot be undone.");

    if (!allowed) {
      return;
    }

    setBusyId(id);
    setError(null);

    const response = await fetch(`/api/services/${id}`, {
      method: "DELETE",
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setError(payload?.error ?? "Unable to delete service.");
      setBusyId(null);
      return;
    }

    setItems((prev) => prev.filter((item) => item.id !== id));
    setBusyId(null);
  }

  const successMessage = useMemo(() => bannerFor(searchParams.get("success")), [searchParams]);

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
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Services</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Manage pricing, categories, and service visibility.</p>
          </div>

          <Link
            href="/services/new"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)]"
          >
            <Plus className="h-4 w-4" />
            Add Service
          </Link>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-10 rounded-xl border border-[var(--border)] bg-white px-3 text-sm"
          >
            {["ALL", ...categories].map((item) => (
              <option key={item} value={item}>
                {item === "ALL" ? "All Categories" : item}
              </option>
            ))}
          </select>

          <div className="inline-flex rounded-xl border border-[var(--border)] p-1">
            <button
              type="button"
              onClick={() => setView("grid")}
              className={[
                "inline-flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-semibold",
                view === "grid" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50",
              ].join(" ")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Grid
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={[
                "inline-flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-semibold",
                view === "list" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50",
              ].join(" ")}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
          </div>
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
          <p className="text-base font-semibold text-[var(--foreground)]">No services found for this category.</p>
          <Link
            href="/services/new"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)]"
          >
            Add Your First Service
          </Link>
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onToggle={toggleStatus}
              onDelete={removeService}
              busy={busyId === service.id}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
          <table className="min-w-[780px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((service) => (
                <tr key={service.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[var(--foreground)]">{service.name}</p>
                    <p className="text-xs text-[var(--muted)]">{service.description || "No description"}</p>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{service.category}</td>
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">{formatCurrency(service.price)}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{service.duration} min</td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "rounded-full px-2.5 py-1 text-xs font-semibold",
                        service.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700",
                      ].join(" ")}
                    >
                      {service.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/services/${service.id}/edit`}
                        className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-slate-700"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => toggleStatus(service.id)}
                        className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-slate-700"
                        disabled={busyId === service.id}
                      >
                        Toggle
                      </button>
                      <button
                        type="button"
                        onClick={() => removeService(service.id)}
                        className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700"
                        disabled={busyId === service.id}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
