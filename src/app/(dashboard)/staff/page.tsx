"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { StaffCard } from "@/components/staff/StaffCard";

type StaffRow = {
  id: string;
  name: string;
  designation: string;
  mobile: string | null;
  email: string | null;
  status: "ACTIVE" | "INACTIVE";
  availabilityStatus: "AVAILABLE" | "BUSY" | "OFF_DUTY";
  displayStatus: "AVAILABLE" | "BUSY" | "OFF_DUTY" | "INACTIVE";
  todayAppointments: number;
  totalAppointments: number;
  avgRating: number;
  workingDays: string[];
  attendanceStatusToday: string | null;
  createdAt: string;
};

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

export default function StaffPage() {
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");

  const [items, setItems] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadStaff() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (status !== "ALL") {
          params.set("status", status);
        }

        const response = await fetch(`/api/staff?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as { error?: string; items?: StaffRow[] };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load staff.");
        }

        if (!active) {
          return;
        }

        setItems(payload.items ?? []);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load staff.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadStaff();

    return () => {
      active = false;
    };
  }, [status]);

  const filtered = useMemo(() => {
    const input = query.trim().toLowerCase();

    if (!input) {
      return items;
    }

    return items.filter((item) => {
      return (
        item.name.toLowerCase().includes(input) ||
        item.designation.toLowerCase().includes(input) ||
        (item.mobile || "").includes(input)
      );
    });
  }, [items, query]);

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <header className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Staff</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Manage staff roster, availability, and profile insights.</p>
          </div>

          <Link
            href="/staff/new"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)]"
          >
            <Plus className="h-4 w-4" />
            Add Staff
          </Link>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, role, or mobile"
            className="h-10 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)] sm:max-w-sm"
          />

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
            className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </header>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-52 animate-pulse rounded-2xl border border-[var(--border)] bg-white" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-16 text-center">
          <p className="text-base font-semibold text-[var(--foreground)]">No staff records match your filters.</p>
          <Link
            href="/staff/new"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)]"
          >
            Add Staff Member
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((member) => (
            <StaffCard key={member.id} member={member} />
          ))}
        </div>
      )}
    </div>
  );
}
