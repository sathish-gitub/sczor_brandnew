"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Calendar, Eye, Search, Trash } from "lucide-react";

type LoyaltyTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";

type CustomerRow = {
  id: string;
  name: string;
  mobile: string;
  totalVisits: number;
  totalSpent: number;
  loyaltyTier: LoyaltyTier;
  lastVisit: string | null;
  createdAt: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const avatarColors = [
  "bg-blue-100 text-blue-700",
  "bg-sky-100 text-sky-700",
  "bg-indigo-100 text-indigo-700",
  "bg-cyan-100 text-cyan-700",
];

const loyaltyStyles: Record<LoyaltyTier, string> = {
  BRONZE: "bg-[#FEF3C7] text-[#92400E]",
  SILVER: "bg-[#F1F5F9] text-[#475569]",
  GOLD: "bg-[#FEF9C3] text-[#854D0E]",
  PLATINUM: "bg-[#EDE9FE] text-[#5B21B6]",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function colorForName(name: string) {
  const hash = Array.from(name).reduce((total, char) => total + char.charCodeAt(0), 0);
  return avatarColors[hash % avatarColors.length];
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function TableSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4">
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-10 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<CustomerRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 250);

    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    let active = true;

    async function loadCustomers() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "20",
        });

        if (search) {
          params.set("search", search);
        }

        const response = await fetch(`/api/customers?${params.toString()}`, {
          cache: "no-store",
        });

        const payload = (await response.json()) as {
          error?: string;
          items?: CustomerRow[];
          pagination?: Pagination;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load customers.");
        }

        if (!active) {
          return;
        }

        setItems(payload.items ?? []);
        setPagination(payload.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 1 });
      } catch (loadError) {
        if (!active) {
          return;
        }

        console.error(loadError);
        setError(loadError instanceof Error ? loadError.message : "Unable to load customers.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadCustomers();

    return () => {
      active = false;
    };
  }, [search, page]);

  async function removeCustomer(customerId: string) {
    const allowed = window.confirm("Delete this customer? This cannot be undone.");

    if (!allowed) {
      return;
    }

    const response = await fetch(`/api/customers/${customerId}`, {
      method: "DELETE",
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setError(payload?.error ?? "Unable to delete customer.");
      return;
    }

    setItems((existing) => existing.filter((item) => item.id !== customerId));
  }

  const hasEmptyState = !loading && items.length === 0;
  const totalLabel = useMemo(() => `${pagination.total} customers`, [pagination.total]);

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <header className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Customers</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{totalLabel}</p>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or mobile"
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-white pl-9 pr-3 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>

          <Link
            href="/customers/new"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)]"
          >
            + Add Customer
          </Link>
        </div>
      </header>

      <div className="rounded-xl border border-[var(--border)] bg-white p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or mobile number"
            className="h-11 w-full rounded-xl border border-[var(--border)] bg-white pl-9 pr-3 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : hasEmptyState ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-16 text-center">
          <p className="text-base font-semibold text-[var(--foreground)]">No customers yet. Add your first customer!</p>
          <Link
            href="/customers/new"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)]"
          >
            Add Customer
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
          <table className="w-full min-w-[920px] table-fixed text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 w-[22%]">Name</th>
                <th className="px-4 py-3 w-[15%]">Mobile</th>
                <th className="px-4 py-3 w-[10%]">Total Visits</th>
                <th className="px-4 py-3 w-[15%]">Total Spent</th>
                <th className="px-4 py-3 w-[14%]">Loyalty Tier</th>
                <th className="px-4 py-3 w-[14%]">Last Visit</th>
                <th className="sticky right-0 z-10 w-[10%] bg-slate-50 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((customer) => (
                <tr key={customer.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={[
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                          colorForName(customer.name),
                        ].join(" ")}
                      >
                        {initials(customer.name)}
                      </div>
                      <span className="truncate font-medium text-[var(--foreground)]">{customer.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--foreground)]">{customer.mobile}</td>
                  <td className="px-4 py-3 text-[var(--foreground)]">{customer.totalVisits}</td>
                  <td className="px-4 py-3 text-[var(--foreground)]">{formatCurrency(customer.totalSpent)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${loyaltyStyles[customer.loyaltyTier]}`}>
                      {customer.loyaltyTier}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--foreground)]">{formatDate(customer.lastVisit)}</td>
                  <td className="sticky right-0 bg-white px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] hover:border-[var(--accent)]"
                        aria-label="View profile"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <Link
                        href={`/appointments/new?customerId=${customer.id}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] hover:border-[var(--accent)]"
                        aria-label="New appointment"
                      >
                        <Calendar className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeCustomer(customer.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                        aria-label="Delete customer"
                      >
                        <Trash className="h-4 w-4" />
                      </button>
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
          Page {pagination.page} of {pagination.totalPages}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={pagination.page <= 1}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))}
            disabled={pagination.page >= pagination.totalPages}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
