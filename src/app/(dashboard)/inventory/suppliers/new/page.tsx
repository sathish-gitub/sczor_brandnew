"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export default function NewSupplierPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/inventory/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, contactPerson, phone, email, address, notes }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setError(payload?.error ?? "Unable to create supplier.");
      setSubmitting(false);
      return;
    }

    router.push("/inventory/suppliers?success=created");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Add Supplier</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Create a new supplier to link with your inventory products.</p>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
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

        <div className="grid gap-4 sm:grid-cols-2">
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
            rows={3}
            className="w-full rounded-xl border border-[var(--border)] px-3 py-2 outline-none focus:border-[var(--accent)]"
          />
        </label>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)] disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Create Supplier"}
          </button>

          <Link
            href="/inventory/suppliers"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
