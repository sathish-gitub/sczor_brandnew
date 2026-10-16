"use client";

import Link from "next/link";

import { useAccess } from "@/contexts/AccessContext";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Edit, Eye, LoaderCircle, Plus, Receipt, Search, Trash } from "lucide-react";

import { StatusBadge } from "@/components/appointments/StatusBadge";
import { AppointmentViewTabs } from "@/components/appointments/calendar/AppointmentViewTabs";
import { WhatsAppConfirmationButton } from "@/components/appointments/WhatsAppConfirmationButton";
import {
  canCancelAppointment,
  canConvertToInvoice,
  canSendBookingConfirmation,
  canViewInvoice,
} from "@/lib/appointmentStatusActions";
import { combinedServiceNames, distinctStaffLabel } from "@/lib/appointmentDisplay";
import { maskId } from "@/lib/formatId";
import { istMonthBounds, istWallTimeToInstant, istWeekBounds, todayISTDateString, toISTDateString } from "@/lib/time";

type AppointmentServiceLineRow = {
  id: string;
  duration: number;
  price: number;
  service: { id: string; name: string };
  staff: { id: string; name: string } | null;
};

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
  services: AppointmentServiceLineRow[];
  invoice: { id: string; invoiceNumber: string } | null;
};

type Stats = {
  total: number;
  booked: number;
  inProgress: number;
  completed: number;
  billed: number;
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
    timeZone: "Asia/Kolkata",
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

function StatsCard({
  label,
  value,
  status,
  selected,
  onSelect,
}: {
  label: string;
  value: string | number;
  status?: string;
  selected?: boolean;
  onSelect?: (status: string) => void;
}) {
  const isClickable = status && onSelect;
  
  if (!isClickable) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--muted)]">{label}</p>
        <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{value}</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(status)}
      aria-pressed={selected}
      className={`rounded-xl border p-4 text-left transition-colors ${
        selected
          ? "border-[var(--primary)] bg-[var(--primary)] bg-opacity-5"
          : "border-[var(--border)] bg-white hover:bg-slate-50"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{value}</p>
    </button>
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return "today";
  }

  const todayStr = todayISTDateString();

  if (dateValue === todayStr) {
    return "today";
  }

  const target = istWallTimeToInstant(dateValue, "00:00");
  const week = istWeekBounds(todayStr);

  if (target >= week.start && target < week.end) {
    return "this_week";
  }

  const month = istMonthBounds(todayStr);

  if (target >= month.start && target < month.end) {
    return "this_month";
  }

  return "this_month";
}


export default function AppointmentsPage() {
  const access = useAccess();
  const searchParams = useSearchParams();
  const navigationToken = searchParams.get("t");
  const savedDate = searchParams.get("date");
  const createdAppointmentId = searchParams.get("appointmentId");
  const [salonName, setSalonName] = useState("");
  const [salonPhone, setSalonPhone] = useState("");
  const [period, setPeriod] = useState<"today" | "this_week" | "this_month">(
    savedDate ? periodContaining(savedDate) : "today",
  );
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("ALL");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, booked: 0, inProgress: 0, completed: 0, billed: 0, cancelled: 0 });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Debounce the search box (~300ms) before it drives the API query.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchInput]);

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

        if (debouncedSearch) {
          query.set("q", debouncedSearch);
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
        setStats(payload.stats ?? { total: 0, booked: 0, inProgress: 0, completed: 0, billed: 0, cancelled: 0 });
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
  }, [period, status, page, navigationToken, reloadKey, debouncedSearch]);

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

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPeriod(periodContaining(savedDate));
    setStatus("ALL");
    setPage(1);
  }, [navigationToken, savedDate]);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { salonProfile?: { salonName?: string; phone?: string } } | null) => {
        if (data?.salonProfile?.salonName) {
          setSalonName(data.salonProfile.salonName);
        }
        if (data?.salonProfile?.phone) {
          setSalonPhone(data.salonProfile.phone);
        }
      })
      .catch(() => null);
  }, []);

  const successMessage = useMemo(
    () => toastLabel(searchParams.get("success"), savedDate),
    [searchParams, savedDate],
  );

  const createdAppointment = useMemo(
    () => (createdAppointmentId ? rows.find((row) => row.id === createdAppointmentId) ?? null : null),
    [createdAppointmentId, rows],
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
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          <span>{successMessage}</span>
          {createdAppointment && salonName && canSendBookingConfirmation(createdAppointment.status) ? (
            <WhatsAppConfirmationButton
              customerName={createdAppointment.customer.name}
              mobile={createdAppointment.customer.mobile}
              salonName={salonName}
              salonPhone={salonPhone}
              appointmentDate={createdAppointment.appointmentDate}
              appointmentTime={createdAppointment.appointmentTime}
              className="inline-flex h-8 items-center justify-center rounded-lg border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-700 hover:border-emerald-400"
            />
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Appointments</h1>
        <AppointmentViewTabs active="list" />
      </div>

      <header className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
                  {option === "ALL" ? "All Status" : option.replaceAll("_", " ")}
                </option>
              ))}
            </select>

            <Link
              href={access.accessLevel === "READ_ONLY" ? "#" : "/appointments/new"}
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
              New Appointment
            </Link>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by customer name, mobile, appointment ID, or service..."
            className="h-11 w-full rounded-xl border border-[var(--border)] bg-white pl-9 pr-3 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <StatsCard
            label="Total"
            value={stats.total}
            status="ALL"
            selected={status === "ALL"}
            onSelect={(s) => {
              setStatus(s as typeof status);
              setPage(1);
            }}
          />
          <StatsCard
            label="Booked"
            value={stats.booked}
            status="BOOKED"
            selected={status === "BOOKED"}
            onSelect={(s) => {
              setStatus(s as typeof status);
              setPage(1);
            }}
          />
          <StatsCard
            label="In Progress"
            value={stats.inProgress}
            status="IN_PROGRESS"
            selected={status === "IN_PROGRESS"}
            onSelect={(s) => {
              setStatus(s as typeof status);
              setPage(1);
            }}
          />
          <StatsCard
            label="Completed"
            value={stats.completed}
            status="COMPLETED"
            selected={status === "COMPLETED"}
            onSelect={(s) => {
              setStatus(s as typeof status);
              setPage(1);
            }}
          />
          <StatsCard
            label="Billed"
            value={stats.billed}
            status="BILLED"
            selected={status === "BILLED"}
            onSelect={(s) => {
              setStatus(s as typeof status);
              setPage(1);
            }}
          />
          <StatsCard
            label="Cancelled"
            value={stats.cancelled}
            status="CANCELLED"
            selected={status === "CANCELLED"}
            onSelect={(s) => {
              setStatus(s as typeof status);
              setPage(1);
            }}
          />
        </div>
      </header>

      {loading ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-14 text-center">
          <p className="text-base font-semibold text-[var(--foreground)]">No appointments found.</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Try another date, status, or search term, or create your first appointment.
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
              {rows.map((row) => {
                const serviceNames = combinedServiceNames(row.services);
                const staffLabel = distinctStaffLabel(row.services);

                return (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                    {row.appointmentNumber ?? `SCZO-${toISTDateString(new Date(row.appointmentDate)).slice(0, 4)}-${maskId(row.id)}`}
                  </td>
                  <td className="px-4 py-3 text-[var(--foreground)]">
                    <div>{formatDate(row.appointmentDate)}</div>
                    <div className="text-xs text-[var(--muted)]">{row.appointmentTime}</div>
                  </td>
                  <td className="px-4 py-3 text-[var(--foreground)]">{row.customer.name}</td>
                  <td className="px-4 py-3 text-[var(--foreground)]">{row.customer.mobile}</td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-[var(--foreground)]" title={serviceNames}>
                    {serviceNames}
                  </td>
                  <td className="px-4 py-3 text-[var(--foreground)]">{staffLabel}</td>
                  <td className="px-4 py-3 text-[var(--foreground)]">{row.duration} min</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/appointments/${row.id}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        aria-label="View appointment"
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      {canViewInvoice(Boolean(row.invoice)) ? (
                        <Link
                          href={`/billing/invoices/${row.invoice?.id}`}
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-[var(--primary)] px-2.5 text-xs font-semibold text-white hover:bg-[var(--accent)]"
                          title="View Invoice"
                        >
                          <Receipt className="h-3.5 w-3.5" /> View Invoice
                        </Link>
                      ) : canConvertToInvoice(row.status, Boolean(row.invoice)) && access.accessLevel !== "READ_ONLY" ? (
                        <Link
                          href={`/billing?appointmentId=${row.id}`}
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-[var(--primary)] px-2.5 text-xs font-semibold text-white hover:bg-[var(--accent)]"
                          title="Convert to Invoice"
                        >
                          <Receipt className="h-3.5 w-3.5" /> Convert to Invoice
                        </Link>
                      ) : null}
                      {row.status !== "BILLED" && row.status !== "CANCELLED" ? (
                        <Link
                          href={`/appointments/${row.id}/edit`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                          aria-label="Edit appointment"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                      ) : null}
                      {canCancelAppointment(row.status) ? (
                        <button
                          type="button"
                          onClick={() => cancelAppointment(row.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                          aria-label="Cancel appointment"
                          title="Cancel"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
                );
              })}
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
