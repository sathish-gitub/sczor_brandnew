"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AttendanceSummary } from "@/components/attendance/AttendanceSummary";
import { AttendanceTable } from "@/components/attendance/AttendanceTable";
import { emptyAttendanceStatusCounts, type AttendanceStatusValue } from "@/lib/attendanceStatus";
import { addDaysToDateString, formatISTLongDate, todayISTDateString } from "@/lib/time";

type AttendanceRow = {
  staffId: string;
  name: string;
  designation: string;
  attendanceId: string | null;
  status: AttendanceStatusValue | null;
  displayStatus: AttendanceStatusValue | "NOT_MARKED";
};

type AttendanceResponse = {
  date: string;
  isBusinessWorkingDay: boolean;
  items: AttendanceRow[];
};

type StaffOption = { id: string; name: string };

type ToastMessage = {
  id: string;
  tone: "success" | "error";
  text: string;
};

function createToastId() {
  return Math.random().toString(36).slice(2);
}

export default function AttendancePage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const today = todayISTDateString();
  const dateParam = searchParams.get("date");
  const selectedDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const staffFilter = searchParams.get("staffId") ?? "ALL";
  const [searchQuery, setSearchQuery] = useState("");

  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [isBusinessWorkingDay, setIsBusinessWorkingDay] = useState(true);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [pendingStatuses, setPendingStatuses] = useState<Record<string, AttendanceStatusValue>>({});
  const [savingAll, setSavingAll] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const enqueueToast = useCallback((tone: "success" | "error", text: string) => {
    const id = createToastId();
    setToasts((current) => [...current, { id, tone, text }]);
    setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 2400);
  }, []);

  const hasUnsavedChanges = Object.keys(pendingStatuses).length > 0;

  const updateQuery = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    let active = true;

    async function loadStaffOptions() {
      const response = await fetch("/api/staff?status=ACTIVE", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | { items?: Array<{ id: string; name: string }> }
        | null;

      if (!active) {
        return;
      }

      setStaffOptions(payload?.items?.map((item) => ({ id: item.id, name: item.name })) ?? []);
    }

    loadStaffOptions();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadAttendance() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ date: selectedDate });
        if (staffFilter !== "ALL") {
          params.set("staffId", staffFilter);
        }

        const response = await fetch(`/api/attendance?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as AttendanceResponse & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load attendance.");
        }

        if (!active) {
          return;
        }

        setRows(payload.items ?? []);
        setIsBusinessWorkingDay(payload.isBusinessWorkingDay ?? true);
        setPendingStatuses({});
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load attendance.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadAttendance();

    return () => {
      active = false;
    };
  }, [selectedDate, staffFilter]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const clickHandler = (event: MouseEvent) => {
      if (!hasUnsavedChanges) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;

      if (!anchor) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) {
        return;
      }

      const allow = window.confirm("You have unsaved attendance changes. Leave this page?");
      if (!allow) {
        event.preventDefault();
      }
    };

    document.addEventListener("click", clickHandler);
    return () => document.removeEventListener("click", clickHandler);
  }, [hasUnsavedChanges]);

  function defaultStatusFor(row: AttendanceRow): AttendanceStatusValue {
    if (row.status) {
      return row.status;
    }

    return row.displayStatus === "WEEK_OFF" ? "WEEK_OFF" : "PRESENT";
  }

  async function saveAll() {
    const updates = rows.map((row) => ({
      staffId: row.staffId,
      status: pendingStatuses[row.staffId] ?? defaultStatusFor(row),
    }));

    if (updates.length === 0) {
      enqueueToast("success", "No attendance rows to save.");
      return;
    }

    setSavingAll(true);

    const response = await fetch("/api/attendance/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        date: selectedDate,
        attendances: updates,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string; successCount?: number } | null;

    if (!response.ok) {
      enqueueToast("error", payload?.error ?? "Unable to save attendance changes.");
      setSavingAll(false);
      return;
    }

    const updateMap = new Map(updates.map((item) => [item.staffId, item.status]));

    setRows((current) =>
      current.map((row) => {
        const nextStatus = updateMap.get(row.staffId);

        if (!nextStatus) {
          return row;
        }

        return {
          ...row,
          status: nextStatus,
          displayStatus: nextStatus,
        };
      }),
    );

    setPendingStatuses({});
    setSavingAll(false);
    enqueueToast("success", `Attendance saved (${payload?.successCount ?? updates.length} entries).`);
  }

  function onStatusChange(staffId: string, status: AttendanceStatusValue) {
    setPendingStatuses((current) => ({
      ...current,
      [staffId]: status,
    }));
  }

  const canGoNext = selectedDate < today;

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return rows;
    }

    return rows.filter(
      (row) => row.name.toLowerCase().includes(query) || row.designation.toLowerCase().includes(query),
    );
  }, [rows, searchQuery]);

  function onMarkAll(status: AttendanceStatusValue) {
    // Applies to the currently filtered (staff dropdown + search) rows only.
    setPendingStatuses((current) => {
      const next = { ...current };
      for (const staffId of filteredRows.map((row) => row.staffId)) {
        next[staffId] = status;
      }
      return next;
    });
  }

  function guardedChange(updates: Record<string, string | null>) {
    if (hasUnsavedChanges) {
      const allow = window.confirm("You have unsaved attendance changes. Continue without saving?");
      if (!allow) {
        return;
      }
    }

    updateQuery(updates);
  }

  const counts = useMemo(() => {
    const initial = emptyAttendanceStatusCounts();
    let notMarked = 0;

    for (const row of rows) {
      const status = pendingStatuses[row.staffId] ?? defaultStatusFor(row);
      initial[status] += 1;
    }

    for (const row of rows) {
      if (!row.status && row.displayStatus === "NOT_MARKED" && !pendingStatuses[row.staffId]) {
        notMarked += 1;
      }
    }

    return { counts: initial, notMarked };
  }, [rows, pendingStatuses]);

  return (
    <div className="space-y-5">
      <div className="fixed right-4 top-20 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={[
              "rounded-xl px-4 py-3 text-sm font-medium shadow",
              toast.tone === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-red-200 bg-red-50 text-red-700",
            ].join(" ")}
          >
            {toast.text}
          </div>
        ))}
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <header className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Mark Attendance</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Record daily attendance for your active staff.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              max={today}
              value={selectedDate}
              onChange={(event) => guardedChange({ date: event.target.value })}
              className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm"
            />

            <Link
              href="/attendance/reports"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700 hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              View Reports
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => guardedChange({ date: addDaysToDateString(selectedDate, -1) })}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border)] bg-white px-3 text-sm font-medium text-slate-700"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous Day
            </button>

            <button
              type="button"
              onClick={() => guardedChange({ date: today })}
              className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] bg-white px-3 text-sm font-medium text-slate-700"
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => guardedChange({ date: addDaysToDateString(selectedDate, 1) })}
              disabled={!canGoNext}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border)] bg-white px-3 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              Next Day
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <p className="text-sm font-semibold text-[var(--foreground)]">{formatISTLongDate(selectedDate)}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={staffFilter}
            onChange={(event) => guardedChange({ staffId: event.target.value === "ALL" ? null : event.target.value })}
            className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm"
          >
            <option value="ALL">All Staff</option>
            {staffOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>

          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by name or designation..."
            className="h-10 flex-1 rounded-xl border border-[var(--border)] px-3 text-sm"
          />

          {!isBusinessWorkingDay ? (
            <span className="inline-flex h-10 items-center rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700">
              Salon closed this day — staff default to Week Off
            </span>
          ) : null}
        </div>
      </header>

      {loading ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
          <div className="h-[420px] animate-pulse rounded-2xl border border-[var(--border)] bg-white" />
          <div className="h-[260px] animate-pulse rounded-2xl border border-[var(--border)] bg-white" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-16 text-center">
          <p className="text-base font-semibold text-[var(--foreground)]">No staff found. Add staff first.</p>
          <Link
            href="/staff/new"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)]"
          >
            Add Staff
          </Link>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-16 text-center">
          <p className="text-base font-semibold text-[var(--foreground)]">No staff match &quot;{searchQuery}&quot;.</p>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
          <AttendanceTable
            rows={filteredRows}
            pendingStatuses={pendingStatuses}
            savingAll={savingAll}
            hasUnsavedChanges={hasUnsavedChanges}
            onMarkAll={onMarkAll}
            onStatusChange={onStatusChange}
            onSaveAll={saveAll}
          />

          <AttendanceSummary counts={counts.counts} notMarked={counts.notMarked} title="Today's Summary" totalOverride={rows.length} />
        </div>
      )}
    </div>
  );
}
