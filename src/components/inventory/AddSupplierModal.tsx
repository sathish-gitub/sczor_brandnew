"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/Modal";

export type CreatedSupplier = {
  id: string;
  name: string;
};

type AddSupplierModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (supplier: CreatedSupplier) => void;
};

/**
 * Shared "+ Add New Supplier" modal used from the product forms' SupplierSelect and the
 * New Purchase Order form. Reuses the same fields/validation as the full supplier page and
 * posts through POST /api/inventory/suppliers, surfacing the server's duplicate-name (409)
 * message inline.
 */
export function AddSupplierModal({ open, onClose, onCreated }: AddSupplierModalProps) {
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setContactPerson("");
    setPhone("");
    setEmail("");
    setAddress("");
    setNotes("");
    setError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function submit() {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/inventory/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contactPerson, phone, email, address, notes }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; supplier?: CreatedSupplier } | null;

      if (!response.ok || !payload?.supplier) {
        setError(payload?.error ?? "Unable to create supplier.");
        return;
      }

      onCreated(payload.supplier);
      resetForm();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add New Supplier" size="md">
      <div
        className="space-y-3"
        onKeyDown={(event) => {
          if (event.key === "Enter" && !(event.target instanceof HTMLTextAreaElement)) {
            event.preventDefault();
            void submit();
          }
        }}
      >        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              required
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3 outline-none focus:border-[var(--accent)]"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Contact Person</span>
            <input
              value={contactPerson}
              onChange={(event) => setContactPerson(event.target.value)}
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3 outline-none focus:border-[var(--accent)]"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Phone</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3 outline-none focus:border-[var(--accent)]"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3 outline-none focus:border-[var(--accent)]"
            />
          </label>
        </div>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-[var(--foreground)]">Address</span>
          <textarea
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            rows={2}
            className="w-full rounded-xl border border-[var(--border)] px-3 py-2 outline-none focus:border-[var(--accent)]"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-[var(--foreground)]">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="w-full rounded-xl border border-[var(--border)] px-3 py-2 outline-none focus:border-[var(--accent)]"
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting || name.trim().length < 2}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)] disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Create Supplier"}
          </button>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
