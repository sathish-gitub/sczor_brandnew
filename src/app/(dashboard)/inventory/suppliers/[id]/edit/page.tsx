"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type SupplierPayload = {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

export default function EditSupplierPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSupplier() {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/inventory/suppliers/${params.id}`, { cache: "no-store" });
      const payload = (await response.json()) as { error?: string; supplier?: SupplierPayload };

      if (!response.ok || !payload.supplier) {
        if (active) {
          setError(payload.error ?? "Unable to load supplier.");
          setLoading(false);
        }
        return;
      }

      if (!active) {
        return;
      }

      setName(payload.supplier.name);
      setContactPerson(payload.supplier.contactPerson || "");
      setPhone(payload.supplier.phone || "");
      setEmail(payload.supplier.email || "");
      setAddress(payload.supplier.address || "");
      setNotes(payload.supplier.notes || "");
      setLoading(false);
    }

    loadSupplier();

    return () => {
      active = false;
    };
  }, [params.id]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/inventory/suppliers/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, contactPerson, phone, email, address, notes }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setError(payload?.error ?? "Unable to update supplier.");
      setSubmitting(false);
      return;
    }

    router.push("/inventory/suppliers?success=updated");
    router.refresh();
  }

  if (loading) {
    return <div className="h-56 animate-pulse rounded-2xl border border-[var(--border)] bg-white" />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Edit {name}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Update supplier contact details.</p>
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
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Contact Person</span>
            <input
              value={contactPerson}
              onChange={(event) => setContactPerson(event.target.value)}
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Phone</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            />
          </label>
        </div>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-[var(--foreground)]">Address</span>
          <textarea
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            rows={2}
            className="w-full rounded-xl border border-[var(--border)] px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-[var(--foreground)]">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="w-full rounded-xl border border-[var(--border)] px-3 py-2"
          />
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
