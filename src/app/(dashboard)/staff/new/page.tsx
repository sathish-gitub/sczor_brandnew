"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const designations = [
  "Beautician",
  "Hair Stylist",
  "Nail Artist",
  "Makeup Artist",
  "Spa Therapist",
  "Receptionist",
  "Manager",
] as const;

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export default function NewStaffPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [designation, setDesignation] = useState<(typeof designations)[number]>("Beautician");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [availabilityStatus, setAvailabilityStatus] = useState<"AVAILABLE" | "BUSY" | "OFF_DUTY">("AVAILABLE");
  const [workingDays, setWorkingDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleWorkingDay(day: string) {
    setWorkingDays((current) => {
      if (current.includes(day)) {
        return current.filter((item) => item !== day);
      }

      return [...current, day];
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/staff", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        designation,
        mobile,
        email,
        status,
        availabilityStatus,
        workingDays,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setError(payload?.error ?? "Unable to create staff member.");
      setSubmitting(false);
      return;
    }

    router.push("/staff");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Add Staff</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Create a staff profile with schedule and availability settings.</p>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-[var(--border)] bg-white p-5">
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
            <span className="font-medium text-[var(--foreground)]">Designation</span>
            <select
              value={designation}
              onChange={(event) => setDesignation(event.target.value as (typeof designations)[number])}
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            >
              {designations.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Mobile</span>
            <input
              value={mobile}
              onChange={(event) => setMobile(event.target.value)}
              placeholder="10-digit mobile"
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

        <div className="grid gap-4 sm:grid-cols-2">
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

          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Availability</span>
            <select
              value={availabilityStatus}
              onChange={(event) => setAvailabilityStatus(event.target.value as "AVAILABLE" | "BUSY" | "OFF_DUTY")}
              className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
            >
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="BUSY">BUSY</option>
              <option value="OFF_DUTY">OFF_DUTY</option>
            </select>
          </label>
        </div>

        <section>
          <p className="text-sm font-medium text-[var(--foreground)]">Working Days</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {weekDays.map((day) => {
              const active = workingDays.includes(day);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleWorkingDay(day)}
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-semibold",
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-[var(--border)] bg-white text-slate-700",
                  ].join(" ")}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </section>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)] disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Create Staff"}
          </button>

          <Link
            href="/staff"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
