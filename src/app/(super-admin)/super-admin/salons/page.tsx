"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, LoaderCircle } from "lucide-react";

import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { addDaysToDateString, formatISTDateDDMMYYYY, toISTDateString, todayISTDateString } from "@/lib/time";

type Salon = {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerMobile: string;
  plan: string;
  status: "TRIAL" | "MONTHLY" | "YEARLY" | "EXPIRED" | "INACTIVE";
  trialEndsAt: string | null;
  subscriptionStart: string | null;
  subscriptionEnd: string | null;
  createdAt: string;
  isActive: boolean;
};

type SalonsResponse = {
  salons: Salon[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

const FILTERS = ["ALL", "TRIAL", "MONTHLY", "YEARLY", "INACTIVE"] as const;

const STATUS_BADGE_CLASSES: Record<string, string> = {
  TRIAL: "bg-blue-100 text-blue-700",
  MONTHLY: "bg-emerald-100 text-emerald-700",
  YEARLY: "bg-emerald-900/10 text-emerald-900",
  EXPIRED: "bg-orange-100 text-orange-700",
  INACTIVE: "bg-slate-100 text-slate-600",
};

/** "YYYY-MM-DD" (IST calendar date) for an `<input type="date">`, or "" when unset. */
function toDateInput(value: string | null) {
  if (!value) return "";
  return toISTDateString(new Date(value));
}

export default function SalonsPage() {
  const { showToast } = useToast();
  const [salons, setSalons] = useState<Salon[]>([]);
  const [pagination, setPagination] = useState<SalonsResponse["pagination"] | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [planModalSalon, setPlanModalSalon] = useState<Salon | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filter !== "ALL") params.set("status", filter);
      params.set("page", String(page));

      const response = await fetch(`/api/super-admin/salons?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as SalonsResponse;

      if (response.ok) {
        setSalons(payload.salons);
        setPagination(payload.pagination);
      }
    } finally {
      setLoading(false);
    }
  }, [search, filter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleActive(salon: Salon) {
    const response = await fetch(`/api/super-admin/salons/${salon.id}/toggle`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !salon.isActive }),
    });

    if (!response.ok) {
      showToast({ title: "Failed to update salon status", variant: "error" });
      return;
    }

    showToast({ title: `${salon.name} ${!salon.isActive ? "activated" : "deactivated"}`, variant: "success" });
    load();
  }

  function exportCsv() {
    const header = ["Salon Name", "Owner", "Email", "Mobile", "Plan", "Trial Ends", "Plan End", "Status", "Joined"];
    const rows = salons.map((salon) => [
      salon.name,
      salon.ownerName,
      salon.ownerEmail,
      salon.ownerMobile,
      salon.plan,
      salon.plan === "FREE_TRIAL" && salon.trialEndsAt ? formatISTDateDDMMYYYY(salon.trialEndsAt) : "-",
      salon.plan !== "FREE_TRIAL" && salon.subscriptionEnd ? formatISTDateDDMMYYYY(salon.subscriptionEnd) : "-",
      salon.status,
      formatISTDateDDMMYYYY(salon.createdAt),
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "salons.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="All Salons"
        actions={
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-white p-4">
        <input
          value={search}
          onChange={(event) => {
            setPage(1);
            setSearch(event.target.value);
          }}
          placeholder="Search by name or email..."
          className="h-10 w-full max-w-sm rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
        />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setPage(1);
                setFilter(item);
              }}
              className={[
                "rounded-full px-3 py-1.5 text-xs font-semibold",
                filter === item ? "bg-[var(--primary)] text-white" : "bg-slate-100 text-[var(--muted)] hover:bg-slate-200",
              ].join(" ")}
            >
              {item === "ALL" ? "All" : item.charAt(0) + item.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
              <th className="px-4 py-3">Salon Name</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Mobile</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Trial Ends</th>
              <th className="px-4 py-3">Plan End</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="py-10 text-center text-[var(--muted)]">
                  <LoaderCircle className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : salons.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-10 text-center text-[var(--muted)]">
                  No salons found.
                </td>
              </tr>
            ) : (
              salons.map((salon) => (
                <tr key={salon.id} className="border-b border-[var(--border)] last:border-b-0">
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">{salon.name}</td>
                  <td className="px-4 py-3">{salon.ownerName}</td>
                  <td className="px-4 py-3">{salon.ownerEmail}</td>
                  <td className="px-4 py-3">{salon.ownerMobile}</td>
                  <td className="px-4 py-3">{salon.plan}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {salon.plan === "FREE_TRIAL" && salon.trialEndsAt ? formatISTDateDDMMYYYY(salon.trialEndsAt) : "-"}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {salon.plan !== "FREE_TRIAL" && salon.subscriptionEnd ? formatISTDateDDMMYYYY(salon.subscriptionEnd) : "-"}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {formatISTDateDDMMYYYY(salon.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE_CLASSES[salon.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {salon.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleActive(salon)}
                        className={[
                          "relative h-6 w-11 rounded-full transition-colors",
                          salon.isActive ? "bg-emerald-500" : "bg-slate-300",
                        ].join(" ")}
                        aria-label="Toggle active status"
                      >
                        <span
                          className={[
                            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                            salon.isActive ? "translate-x-5" : "translate-x-0.5",
                          ].join(" ")}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPlanModalSalon(salon)}
                        className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-slate-50"
                      >
                        Change Plan
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-[var(--muted)]">
          <span>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} salons)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 font-semibold disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((value) => value + 1)}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 font-semibold disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <ChangePlanModal
        key={planModalSalon?.id ?? "none"}
        salon={planModalSalon}
        onClose={() => setPlanModalSalon(null)}
        onSaved={load}
      />
    </div>
  );
}

function ChangePlanModal({
  salon,
  onClose,
  onSaved,
}: {
  salon: Salon | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [plan, setPlan] = useState(() => salon?.plan ?? "FREE_TRIAL");
  // Trial start has no persisted column (Tenant only stores trialEndsAt) — it always
  // defaults to today's IST calendar date and exists purely to validate the end date.
  const [trialStart, setTrialStart] = useState(() => todayISTDateString());
  const [trialEnd, setTrialEnd] = useState(() =>
    salon?.plan === "FREE_TRIAL" && salon.trialEndsAt
      ? toDateInput(salon.trialEndsAt)
      : addDaysToDateString(todayISTDateString(), 14),
  );
  const [subscriptionStart, setSubscriptionStart] = useState(
    () => toDateInput(salon?.subscriptionStart ?? null) || todayISTDateString(),
  );
  const [subscriptionEnd, setSubscriptionEnd] = useState(() => toDateInput(salon?.subscriptionEnd ?? null));
  const [saving, setSaving] = useState(false);

  if (!salon) {
    return null;
  }

  const isTrialPlan = plan === "FREE_TRIAL";
  const isPaidPlan = plan === "MONTHLY" || plan === "YEARLY";

  async function save() {
    if (!salon) return;

    if (isTrialPlan && trialEnd < trialStart) {
      showToast({ title: "Trial end date cannot be before the start date", variant: "error" });
      return;
    }

    if (isPaidPlan && subscriptionEnd && subscriptionEnd < subscriptionStart) {
      showToast({ title: "End date cannot be before the start date", variant: "error" });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/super-admin/salons/${salon.id}/plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          trialStart: isTrialPlan ? trialStart : null,
          trialEnd: isTrialPlan ? trialEnd : null,
          subscriptionStart: isPaidPlan ? subscriptionStart : null,
          subscriptionEnd: isPaidPlan ? subscriptionEnd || null : null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        showToast({ title: payload?.error ?? "Failed to update plan", variant: "error" });
        return;
      }

      showToast({ title: "Plan updated", variant: "success" });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={Boolean(salon)} onClose={onClose} title={`Change Plan – ${salon.name}`}>
      <div className="space-y-4">
        <p className="-mt-2 text-xs text-[var(--muted)]">
          {salon.plan === "FREE_TRIAL"
            ? `Trial ends: ${salon.trialEndsAt ? formatISTDateDDMMYYYY(salon.trialEndsAt) : "-"}`
            : `Plan ends: ${salon.subscriptionEnd ? formatISTDateDDMMYYYY(salon.subscriptionEnd) : "-"}`}
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Plan</label>
          <select
            value={plan}
            onChange={(event) => setPlan(event.target.value)}
            className="h-10 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
          >
            <option value="FREE_TRIAL">Trial</option>
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
            <option value="FREE">Free</option>
          </select>
        </div>
        {isTrialPlan ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Start Date</label>
              <input
                type="date"
                value={trialStart}
                onChange={(event) => setTrialStart(event.target.value)}
                className="h-10 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">End Date</label>
              <input
                type="date"
                value={trialEnd}
                onChange={(event) => setTrialEnd(event.target.value)}
                className="h-10 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>
        ) : isPaidPlan ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Start Date</label>
              <input
                type="date"
                value={subscriptionStart}
                onChange={(event) => setSubscriptionStart(event.target.value)}
                className="h-10 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">End Date</label>
              <input
                type="date"
                value={subscriptionEnd}
                onChange={(event) => setSubscriptionEnd(event.target.value)}
                className="h-10 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>
        ) : null}
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] text-sm font-semibold text-white hover:bg-[var(--accent)] disabled:opacity-70"
        >
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          Save
        </button>
      </div>
    </Modal>
  );
}
