"use client";

import Link from "next/link";

import { useAccess } from "@/contexts/AccessContext";
import { useSearchParams } from "next/navigation";
import { LayoutGrid, List, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ServiceCard } from "@/components/services/ServiceCard";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

type ServiceItem = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  duration: number;
  status: "ACTIVE" | "INACTIVE";
};

type CategoryOption = {
  id: string;
  name: string;
};

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
  const access = useAccess();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const [items, setItems] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("ALL");
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const [inlineAdding, setInlineAdding] = useState(false);
  const [inlineCategoryName, setInlineCategoryName] = useState("");

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  useEffect(() => {
    let active = true;

    async function loadCategories() {
      const response = await fetch("/api/services/categories", { cache: "no-store" });
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

  async function createCategory(name: string) {
    const trimmed = name.trim();

    if (trimmed.length < 2) {
      return { error: "Category name must be at least 2 characters." };
    }

    const response = await fetch("/api/services/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; category?: CategoryOption }
      | null;

    if (!response.ok || !payload?.category) {
      return { error: payload?.error ?? "Unable to add category." };
    }

    const created = payload.category;

    setCategories((current) =>
      current.some((item) => item.id === created.id)
        ? current
        : [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
    );

    return { category: created };
  }

  async function handleSaveCategoryModal() {
    setSavingCategory(true);
    setCategoryError(null);

    const result = await createCategory(newCategoryName);

    setSavingCategory(false);

    if (result.error) {
      setCategoryError(result.error);
      return;
    }

    showToast({ variant: "success", title: `Category "${result.category!.name}" added` });
    setNewCategoryName("");
    setShowCategoryModal(false);
  }

  async function handleInlineAddCategory() {
    const result = await createCategory(inlineCategoryName);

    if (result.error) {
      showToast({ variant: "error", title: "Unable to add category", message: result.error });
      return;
    }

    showToast({ variant: "success", title: `Category "${result.category!.name}" added` });
    setInlineCategoryName("");
    setInlineAdding(false);
  }

  async function handleRenameCategory(categoryItem: CategoryOption) {
    const trimmed = editingCategoryName.trim();

    if (trimmed.length < 2 || trimmed === categoryItem.name) {
      setEditingCategoryId(null);
      return;
    }

    const response = await fetch(`/api/services/categories/${categoryItem.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; category?: CategoryOption }
      | null;

    if (!response.ok || !payload?.category) {
      showToast({ variant: "error", title: "Unable to rename category", message: payload?.error });
      setEditingCategoryId(null);
      return;
    }

    const updated = payload.category;

    setCategories((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)).sort((a, b) => a.name.localeCompare(b.name)),
    );

    if (category === categoryItem.name) {
      setCategory(updated.name);
    }

    showToast({ variant: "success", title: "Category renamed" });
    setEditingCategoryId(null);
  }

  async function handleDeleteCategory(categoryItem: CategoryOption) {
    const allowed = window.confirm(`Delete category "${categoryItem.name}"?`);

    if (!allowed) {
      return;
    }

    const response = await fetch(`/api/services/categories/${categoryItem.id}`, {
      method: "DELETE",
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      showToast({ variant: "error", title: "Unable to delete category", message: payload?.error });
      return;
    }

    setCategories((current) => current.filter((item) => item.id !== categoryItem.id));

    if (category === categoryItem.name) {
      setCategory("ALL");
    }

    showToast({ variant: "success", title: "Category deleted" });
  }

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

  const groupedItems = useMemo(() => {
    const groups = new Map<string, ServiceItem[]>();

    for (const item of items) {
      const key = item.category || "Other";
      const bucket = groups.get(key) ?? [];
      bucket.push(item);
      groups.set(key, bucket);
    }

    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

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

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowCategoryModal(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#1E40AF] px-4 text-sm font-medium text-[#1E40AF] hover:bg-blue-50"
            >
              <Plus size={16} />
              Add Category
            </button>
            <Link
              href={access.accessLevel === "READ_ONLY" ? "#" : "/services/new"}
              aria-disabled={access.accessLevel === "READ_ONLY"}
              onClick={(event) => {
                if (access.accessLevel === "READ_ONLY") {
                  event.preventDefault();
                }
              }}
              className={
                access.accessLevel === "READ_ONLY"
                  ? "inline-flex h-10 cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-300 px-4 text-sm font-semibold text-slate-500"
                  : "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)]"
              }
            >
              <Plus className="h-4 w-4" />
              Add Service
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCategory("ALL")}
            className={[
              "rounded-full px-3 py-1.5 text-sm font-semibold",
              category === "ALL" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
            ].join(" ")}
          >
            All
          </button>

          {categories.map((item) => (
            <div key={item.id} className="group relative">
              {editingCategoryId === item.id ? (
                <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-white px-2 py-1">
                  <input
                    autoFocus
                    value={editingCategoryName}
                    onChange={(event) => setEditingCategoryName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        handleRenameCategory(item);
                      }
                      if (event.key === "Escape") {
                        setEditingCategoryId(null);
                      }
                    }}
                    className="w-24 text-sm outline-none"
                  />
                  <button type="button" onClick={() => handleRenameCategory(item)} className="text-emerald-600">
                    ✓
                  </button>
                  <button type="button" onClick={() => setEditingCategoryId(null)} className="text-slate-400">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCategory(item.name)}
                  className={[
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold",
                    category === item.name ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                  ].join(" ")}
                >
                  {item.name}
                  <span className="hidden items-center gap-1 group-hover:inline-flex">
                    <Pencil
                      className="h-3 w-3 opacity-70 hover:opacity-100"
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditingCategoryId(item.id);
                        setEditingCategoryName(item.name);
                      }}
                    />
                    <Trash2
                      className="h-3 w-3 opacity-70 hover:opacity-100"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteCategory(item);
                      }}
                    />
                  </span>
                </button>
              )}
            </div>
          ))}

          {inlineAdding ? (
            <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-white px-2 py-1">
              <input
                autoFocus
                value={inlineCategoryName}
                onChange={(event) => setInlineCategoryName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleInlineAddCategory();
                  }
                  if (event.key === "Escape") {
                    setInlineAdding(false);
                    setInlineCategoryName("");
                  }
                }}
                placeholder="Category name"
                className="w-28 text-sm outline-none"
              />
              <button type="button" onClick={handleInlineAddCategory} className="text-emerald-600">
                ✓
              </button>
              <button
                type="button"
                onClick={() => {
                  setInlineAdding(false);
                  setInlineCategoryName("");
                }}
                className="text-slate-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setInlineAdding(true)}
              className="rounded-full border border-dashed border-[var(--border)] px-3 py-1.5 text-sm font-semibold text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              + Add Category
            </button>
          )}
        </div>

        <div className="flex items-center justify-end">
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

      <Modal
        open={showCategoryModal}
        onClose={() => {
          setShowCategoryModal(false);
          setCategoryError(null);
          setNewCategoryName("");
        }}
        title="Add Category"
        size="sm"
      >
        <div className="space-y-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Category name</span>
            <input
              autoFocus
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleSaveCategoryModal();
                }
              }}
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
              placeholder="e.g. Hair"
            />
          </label>

          {categoryError ? <p className="text-sm text-red-600">{categoryError}</p> : null}

          <button
            type="button"
            onClick={handleSaveCategoryModal}
            disabled={savingCategory}
            className="h-10 w-full rounded-xl bg-[var(--primary)] text-sm font-semibold text-white hover:bg-[var(--accent)] disabled:opacity-70"
          >
            {savingCategory ? "Saving..." : "Save"}
          </button>
        </div>
      </Modal>

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
        <div className="space-y-6">
          {groupedItems.map(([categoryName, categoryItems]) => (
            <section key={categoryName} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{categoryName}</h2>
                <Link
                  href={`/services/new?category=${encodeURIComponent(categoryName)}`}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Service
                </Link>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {categoryItems.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    onToggle={toggleStatus}
                    onDelete={removeService}
                    busy={busyId === service.id}
                  />
                ))}
              </div>
            </section>
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
