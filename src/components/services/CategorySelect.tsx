"use client";

import { useEffect, useState } from "react";

export type ServiceCategoryOption = {
  id: string;
  name: string;
};

type CategorySelectProps = {
  value: string;
  onChange: (categoryName: string) => void;
};

const ADD_NEW = "__add_new__";

export function CategorySelect({ value, onChange }: CategorySelectProps) {
  const [options, setOptions] = useState<ServiceCategoryOption[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCategories() {
      const response = await fetch("/api/services/categories", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | { items?: ServiceCategoryOption[] }
        | null;

      if (!active || !response.ok) {
        return;
      }

      setOptions(payload?.items ?? []);
    }

    loadCategories();

    return () => {
      active = false;
    };
  }, []);

  async function saveCategory() {
    const name = draft.trim();

    if (name.length < 2) {
      setError("Category name must be at least 2 characters.");
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch("/api/services/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; category?: ServiceCategoryOption }
      | null;

    setSaving(false);

    if (!response.ok || !payload?.category) {
      setError(payload?.error ?? "Unable to add category.");
      return;
    }

    const created = payload.category;

    setOptions((current) =>
      current.some((item) => item.id === created.id)
        ? current
        : [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
    );
    onChange(created.name);
    setDraft("");
    setAdding(false);
  }

  const showsUnlistedValue = Boolean(value) && !options.some((item) => item.name === value);

  return (
    <div className="space-y-2">
      <select
        value={value}
        onChange={(event) => {
          if (event.target.value === ADD_NEW) {
            setAdding(true);
            return;
          }

          onChange(event.target.value);
        }}
        className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
      >
        <option value="">Select category</option>
        {showsUnlistedValue ? <option value={value}>{value}</option> : null}
        {options.map((item) => (
          <option key={item.id} value={item.name}>
            {item.name}
          </option>
        ))}
        <option value={ADD_NEW}>+ Add new category</option>
      </select>

      {adding ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void saveCategory();
              }

              if (event.key === "Escape") {
                setAdding(false);
                setDraft("");
                setError(null);
              }
            }}
            placeholder="New category name"
            className="h-10 w-full rounded-xl border border-[var(--border)] px-3 text-sm"
          />
          <button
            type="button"
            onClick={() => void saveCategory()}
            disabled={saving}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Adding..." : "Add"}
          </button>
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
