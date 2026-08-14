"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const categories = ["Hair", "Skin", "Nail", "Makeup", "Spa", "Other"] as const;

type ServicePayload = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  duration: number;
  status: "ACTIVE" | "INACTIVE";
};

export default function EditServicePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("Hair");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0");
  const [duration, setDuration] = useState("30");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");

  useEffect(() => {
    let active = true;

    async function loadService() {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/services/${params.id}`, { cache: "no-store" });
      const payload = (await response.json()) as { error?: string; service?: ServicePayload };

      if (!response.ok || !payload.service) {
        if (active) {
          setError(payload.error ?? "Unable to load service.");
          setLoading(false);
        }
        return;
      }

      if (!active) {
        return;
      }

      setName(payload.service.name);
      setCategory(payload.service.category as (typeof categories)[number]);
      setDescription(payload.service.description || "");
      setPrice(String(payload.service.price));
      setDuration(String(payload.service.duration));
      setStatus(payload.service.status);
      setLoading(false);
    }

    loadService();

    return () => {
      active = false;
    };
  }, [params.id]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/services/${params.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        category,
        description,
        price,
        duration,
        status,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setError(payload?.error ?? "Unable to update service.");
      setSubmitting(false);
      return;
    }

    router.push("/services?success=updated");
    router.refresh();
  }

  if (loading) {
    return <div className="h-56 animate-pulse rounded-2xl border border-[var(--border)] bg-white" />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Edit {name}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Update service details and availability settings.</p>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Service Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as (typeof categories)[number])}
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-[var(--foreground)]">Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="w-full rounded-xl border border-[var(--border)] px-3 py-2"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Price (INR)</span>
            <input
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              type="number"
              min="1"
              required
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Duration (min)</span>
            <input
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              type="number"
              min="1"
              required
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as "ACTIVE" | "INACTIVE")}
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </label>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)] disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </button>

          <Link
            href="/services"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
