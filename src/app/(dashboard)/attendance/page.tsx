"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AttendanceSummary } from "@/components/attendance/AttendanceSummary";
import { AttendanceTable } from "@/components/attendance/AttendanceTable";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LEAVE" | "HALF_DAY";

type AttendanceRow = {
  staffId: string;
  name: string;
  designation: string;
  attendanceId: string | null;
  status: AttendanceStatus | null;
};

type AttendanceResponse = {
  date: string;
  items: AttendanceRow[];
};

type ToastMessage = {
  id: string;
  tone: "success" | "error";
  text: string;
};

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00`);
}

function addDays(value: string, amount: number) {
  const date = parseDateOnly(value);
  date.setDate(date.getDate() + amount);
  return formatDateInput(date);
}

function longDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parseDateOnly(value));
}

function createToastId() {
  return Math.random().toString(36).slice(2);
}

function statusLabel(value: AttendanceStatus) {
  if (value === "PRESENT") {
    return "Present";
  }

  if (value === "ABSENT") {
    return "Absent";
  }

  if (value === "LEAVE") {
    return "Leave";
  }

  return "Half Day";
}

export default function AttendancePage() {
  const today = useMemo(() => formatDateInput(new Date()), []);

  const [selectedDate, setSelectedDate] = useState(today);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [pendingStatuses, setPendingStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savingAll, setSavingAll] = useState(false);
  const [autoSave, setAutoSave] = useState(false);

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

  useEffect(() => {
    let active = true;

    async function loadAttendance() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/attendance?date=${selectedDate}`, { cache: "no-store" });
        const payload = (await response.json()) as AttendanceResponse & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load attendance.");
        }

        if (!active) {
          return;
        }

        setRows(payload.items ?? []);
        setPendingStatuses({});
        setSelectedIds(new Set());
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
  }, [selectedDate]);

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

  async function saveSingle(staffId: string, statusArg?: AttendanceStatus) {
    const status = statusArg ?? pendingStatuses[staffId] ?? rows.find((row) => row.staffId === staffId)?.status;

    if (!status) {
      return;
    }

    setSavingIds((current) => new Set(current).add(staffId));

    const response = await fetch("/api/attendance/single", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        staffId,
        date: selectedDate,
        status,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      enqueueToast("error", payload?.error ?? "Unable to save attendance.");
      setSavingIds((current) => {
        const next = new Set(current);
        next.delete(staffId);
        return next;
      });
      return;
    }

    setRows((current) =>
      current.map((row) =>
        row.staffId === staffId
          ? {
              ...row,
              status,
            }
          : row,
      ),
    );

    setPendingStatuses((current) => {
      const next = { ...current };
      delete next[staffId];
      return next;
    });

    setSavingIds((current) => {
      const next = new Set(current);
      next.delete(staffId);
      return next;
    });

    const member = rows.find((item) => item.staffId === staffId);
    enqueueToast("success", `${member?.name || "Staff"} marked ${statusLabel(status)}.`);
  }

  async function saveAll() {
    const updates = Object.entries(pendingStatuses).map(([staffId, status]) => ({ staffId, status }));

    if (updates.length === 0) {
      enqueueToast("success", "No pending changes to save.");
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
        };
      }),
    );

    setPendingStatuses({});
    setSavingAll(false);
    enqueueToast("success", `Saved ${payload?.successCount ?? updates.length} attendance entries.`);
  }

  async function onStatusChange(staffId: string, status: AttendanceStatus) {
    setPendingStatuses((current) => ({
      ...current,
      [staffId]: status,
    }));

    if (autoSave) {
      await saveSingle(staffId, status);
    }
  }

  function onToggleSelect(staffId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(staffId)) {
        next.delete(staffId);
      } else {
        next.add(staffId);
      }

      return next;
    });
  }

  function onSelectAll() {
    setSelectedIds((current) => {
      if (current.size === rows.length) {
        return new Set();
      }

      return new Set(rows.map((row) => row.staffId));
    });
  }

  function onMarkAll(status: AttendanceStatus) {
    const targetIds = selectedIds.size > 0 ? [...selectedIds] : rows.map((row) => row.staffId);

    setPendingStatuses((current) => {
      const next = { ...current };
      for (const staffId of targetIds) {
        next[staffId] = status;
      }
      return next;
    });
  }

  function guardedDateChange(nextDate: string) {
    if (hasUnsavedChanges) {
      const allow = window.confirm("You have unsaved attendance changes. Continue without saving?");
      if (!allow) {
        return;
      }
    }

    setSelectedDate(nextDate);
  }

  const canGoNext = selectedDate < today;

  const counts = useMemo(() => {
    const initial = { PRESENT: 0, ABSENT: 0, LEAVE: 0, HALF_DAY: 0 };

    for (const row of rows) {
      const status = pendingStatuses[row.staffId] ?? row.status;
      if (status) {
        initial[status] += 1;
      }
    }

    return initial;
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
              onChange={(event) => guardedDateChange(event.target.value)}
              className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm"
            />

            <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={autoSave}
                onChange={(event) => setAutoSave(event.target.checked)}
                className="h-4 w-4"
              />
              Auto-save
            </label>

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
              onClick={() => guardedDateChange(addDays(selectedDate, -1))}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border)] bg-white px-3 text-sm font-medium text-slate-700"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous Day
            </button>

            <button
              type="button"
              onClick={() => guardedDateChange(today)}
              className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] bg-white px-3 text-sm font-medium text-slate-700"
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => guardedDateChange(addDays(selectedDate, 1))}
              disabled={!canGoNext}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border)] bg-white px-3 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              Next Day
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <p className="text-sm font-semibold text-[var(--foreground)]">{longDate(selectedDate)}</p>
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
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
          <AttendanceTable
            rows={rows}
            selectedIds={selectedIds}
            pendingStatuses={pendingStatuses}
            savingIds={savingIds}
            savingAll={savingAll}
            onToggleSelect={onToggleSelect}
            onSelectAll={onSelectAll}
            onMarkAll={onMarkAll}
            onStatusChange={onStatusChange}
            onSaveSingle={saveSingle}
            onSaveAll={saveAll}
          />

          <AttendanceSummary counts={counts} title="Today's Summary" totalOverride={rows.length} />
        </div>
      )}
    </div>
  );
}
