"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Edit, Eye, LoaderCircle, Plus, Trash } from "lucide-react";

import { StatusBadge } from "@/components/appointments/StatusBadge";
import { maskId } from "@/lib/formatId";

type AppointmentRow = {
  id: string;
  appointmentNumber?: string | null;
  appointmentDate: string;
  appointmentTime: string;
  duration: number;
  status: "BOOKED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "BILLED";
  customer: {
    name: string;
    mobile: string;
  };
  service: {
    name: string;
  };
  staff: {
    name: string;
  };
};

type Stats = {
  total: number;
  booked: number;
  completed: number;
  cancelled: number;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const statusOptions = ["ALL", "BOOKED", "IN_PROGRESS", "COMPLETED", "BILLED", "CANCELLED"] as const;

function formatDate(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function toastLabel(value: string | null, savedDate: string | null) {
  const suffix = savedDate ? ` Showing ${formatDate(savedDate)}.` : "";

  if (value === "created") {
    return `Appointment created successfully.${suffix}`;
  }

  if (value === "updated") {
    return `Appointment updated successfully.${suffix}`;
  }

  return null;
}

function StatsCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4">
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((item) => (
          <div key={item} className="h-10 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

function periodContaining(dateValue: string): "today" | "this_week" | "this_month" {
  const target = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(target.getTime())) {
    return "today";
  }

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  if (target.getTime() === startOfToday.getTime()) {
    return "today";
  }

  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - ((startOfToday.getDay() + 6) % 7));
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  if (target >= startOfWeek && target <= endOfWeek) {
    return "this_week";
  }

  return "this_month";
}

export default function AppointmentsPage() {
  const searchParams = useSearchParams();
  const navigationToken = searchParams.get("t");
  const savedDate = searchParams.get("date");
  const [period, setPeriod] = useState<"today" | "this_week" | "this_month">(
    savedDate ? periodContaining(savedDate) : "today",
  );
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("ALL");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, booked: 0, completed: 0, cancelled: 0 });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 1 });

  useEffect(() => {
    let active = true;

    async function loadAppointments() {
      setLoading(true);
      setError(null);

      try {
        const query = new URLSearchParams({
          date: period,
          page: String(page),
          limit: "10",
        });

        if (status !== "ALL") {
          query.set("status", status);
        }

        const response = await fetch(`/api/appointments?${query.toString()}`, {
          cache: "no-store",
        });

        const payload = (await response.json()) as {
          error?: string;
          items?: AppointmentRow[];
          stats?: Stats;
          pagination?: Pagination;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load appointments.");
        }

        if (!active) {
          return;
        }

        setRows(payload.items ?? []);
        setStats(payload.stats ?? { total: 0, booked: 0, completed: 0, cancelled: 0 });
        setPagination(payload.pagination ?? { page: 1, limit: 10, total: 0, totalPages: 1 });
      } catch (loadError) {
        if (!active) {
          return;
        }

        console.error(loadError);
        setError(loadError instanceof Error ? loadError.message : "Unable to load appointments.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadAppointments();

    return () => {
      active = false;
    };
  }, [period, status, page, navigationToken, reloadKey]);

  useEffect(() => {
    function handleFocus() {
      setReloadKey((value) => value + 1);
    }

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  // Keep a just-saved appointment visible even if it moved outside the active filters.
  useEffect(() => {
    if (!navigationToken || !savedDate) {
      return;
    }

    setPeriod(periodContaining(savedDate));
    setStatus("ALL");
    setPage(1);
  }, [navigationToken, savedDate]);

  const successMessage = useMemo(
    () => toastLabel(searchParams.get("success"), savedDate),
    [searchParams, savedDate],
  );

  async function cancelAppointment(id: string) {
    const allowed = window.confirm("Are you sure you want to cancel this appointment?");

    if (!allowed) {
      return;
    }

    const response = await fetch(`/api/appointments/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Unable to cancel appointment.");
      return;
    }

    setRows((existing) =>
      existing.map((row) =>
        row.id === id
          ? {
              ...row,
              status: "CANCELLED",
            }
          : row,
      ),
    );
  }

  return (
    <div className="space-y-5">
      {successMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <header className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Appointments</h1>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={period}
              onChange={(event) => {
                setPeriod(event.target.value as "today" | "this_week" | "this_month");
                setPage(1);
              }}
              className="h-10 rounded-xl border border-[var(--border)] bg-white px-3 text-sm"
            >
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
            </select>

            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as (typeof statusOptions)[number]);
                setPage(1);
              }}
              className="h-10 rounded-xl border border-[var(--border)] bg-white px-3 text-sm"
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "ALL" ? "All Statuses" : option.replaceAll("_", " ")}
                </option>
              ))}
            </select>

            <Link
              href="/appointments/new"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)]"
            >
              <Plus className="h-4 w-4" />
              New Appointment
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatsCard label="Total" value={stats.total} />
          <StatsCard label="Booked" value={stats.booked} />
          <StatsCard label="Completed" value={stats.completed} />
          <StatsCard label="Cancelled" value={stats.cancelled} />
        </div>
      </header>

      {loading ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-14 text-center">
          <p className="text-base font-semibold text-[var(--foreground)]">No appointments found.</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Try another date or status filter, or create your first appointment.
          </p>
          <Link
            href="/appointments/new"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)]"
          >
            + New Appointment
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
          <table className="min-w-[1120px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Mobile</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                    {row.appointmentNumber ?? `SCZO-${new Date(row.appointmentDate).getFullYear()}-${maskId(row.id)}`}
                  </td>
                  <td className="px-4 py-3 text-[var(--foreground)]">
                    <div>{formatDate(row.appointmentDate)}</div>
                    <div className="text-xs text-[var(--muted)]">{row.appointmentTime}</div>
                  </td>
                  <td className="px-4 py-3 text-[var(--foreground)]">{row.customer.name}</td>
                  <td className="px-4 py-3 text-[var(--foreground)]">{row.customer.mobile}</td>
                  <td className="px-4 py-3 text-[var(--foreground)]">{row.service.name}</td>
                  <td className="px-4 py-3 text-[var(--foreground)]">{row.staff.name}</td>
                  <td className="px-4 py-3 text-[var(--foreground)]">{row.duration} min</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/appointments/${row.id}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        aria-label="View appointment"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      {row.status !== "BILLED" && row.status !== "CANCELLED" ? (
                        <Link
                          href={`/appointments/${row.id}/edit`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                          aria-label="Edit appointment"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                      ) : null}
                      {row.status !== "BILLED" && row.status !== "CANCELLED" ? (
                        <button
                          type="button"
                          onClick={() => cancelAppointment(row.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                          aria-label="Cancel appointment"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3 sm:flex-row">
        <p className="text-sm text-[var(--muted)]">
          Page {pagination.page} of {pagination.totalPages} ({pagination.total} records)
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={pagination.page <= 1 || loading}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            Previous
          </button>

          <button
            type="button"
            onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))}
            disabled={pagination.page >= pagination.totalPages || loading}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            Next
          </button>

          {loading ? <LoaderCircle className="h-4 w-4 animate-spin text-[var(--muted)]" /> : null}
        </div>
      </div>
    </div>
  );
}
