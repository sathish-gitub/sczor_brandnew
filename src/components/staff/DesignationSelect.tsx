"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type StaffDesignationOption = {
  id: string;
  name: string;
};

type DesignationSelectProps = {
  value: string;
  onChange: (designationId: string) => void;
  /** Show the small "Manage designations" link below the select. Defaults to true. */
  showManageLink?: boolean;
  className?: string;
};

const ADD_NEW = "__add_new__";

export function DesignationSelect({ value, onChange, showManageLink = true, className }: DesignationSelectProps) {
  const [options, setOptions] = useState<StaffDesignationOption[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDesignations() {
      const response = await fetch("/api/staff/designations", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | { items?: StaffDesignationOption[] }
        | null;

      if (!active || !response.ok) {
        return;
      }

      setOptions(payload?.items ?? []);
    }

    loadDesignations();

    return () => {
      active = false;
    };
  }, []);

  async function saveDesignation() {
    const name = draft.trim();

    if (name.length < 2) {
      setError("Designation name must be at least 2 characters.");
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch("/api/staff/designations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; designation?: StaffDesignationOption }
      | null;

    setSaving(false);

    if (!response.ok || !payload?.designation) {
      setError(payload?.error ?? "Unable to add designation.");
      return;
    }

    const created = payload.designation;

    setOptions((current) =>
      current.some((item) => item.id === created.id)
        ? current
        : [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
    );
    onChange(created.id);
    setDraft("");
    setAdding(false);
  }

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
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
        <option value="">Select designation</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
        <option value={ADD_NEW}>+ Add New Designation</option>
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
                void saveDesignation();
              }

              if (event.key === "Escape") {
                setAdding(false);
                setDraft("");
                setError(null);
              }
            }}
            placeholder="New designation name"
            className="h-10 w-full rounded-xl border border-[var(--border)] px-3 text-sm"
          />
          <button
            type="button"
            onClick={() => void saveDesignation()}
            disabled={saving}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Adding..." : "Add"}
          </button>
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {showManageLink ? (
        <Link href="/staff/designations" className="inline-block text-xs font-medium text-[var(--primary)] hover:underline">
          Manage designations
        </Link>
      ) : null}
    </div>
  );
}
