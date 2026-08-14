"use client";

import { Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { MonthCalendar } from "@/components/attendance/MonthCalendar";
import { StaffAvatar } from "@/components/staff/StaffAvatar";

type CellStatus = "PRESENT" | "ABSENT" | "LEAVE" | "HALF_DAY" | "OFF";

type ReportRow = {
  staffId: string;
  name: string;
  designation: string;
  cells: Array<{
    day: number;
    weekday: string;
    status: CellStatus;
  }>;
  summary: {
    present: number;
    absent: number;
    leave: number;
    halfDay: number;
    attendancePercent: number;
  };
};

type AttendanceReportResponse = {
  month: number;
  year: number;
  days: Array<{ day: number; weekday: string }>;
  overview: {
    workingDays: number;
    avgAttendancePercent: number;
    perfectAttendanceCount: number;
    mostAbsentStaff: string;
  };
  items: ReportRow[];
};

function formatMonthInput(year: number, month: number) {
  return `${year}-${`${month}`.padStart(2, "0")}`;
}

function statusCellClass(status: CellStatus) {
  if (status === "PRESENT") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "ABSENT") {
    return "bg-red-100 text-red-700";
  }

  if (status === "LEAVE") {
    return "bg-yellow-100 text-yellow-700";
  }

  if (status === "HALF_DAY") {
    return "bg-orange-100 text-orange-700";
  }

  return "bg-slate-100 text-slate-500";
}

function statusCellLabel(status: CellStatus) {
  if (status === "PRESENT") {
    return "P";
  }

  if (status === "ABSENT") {
    return "A";
  }

  if (status === "LEAVE") {
    return "L";
  }

  if (status === "HALF_DAY") {
    return "H";
  }

  return "-";
}

export default function AttendanceReportsPage() {
  const now = useMemo(() => new Date(), []);
  const [monthInput, setMonthInput] = useState(formatMonthInput(now.getFullYear(), now.getMonth() + 1));
  const [staffFilter, setStaffFilter] = useState("ALL");
  const [focusDay, setFocusDay] = useState<number | undefined>(undefined);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AttendanceReportResponse | null>(null);

  const [staffOptions, setStaffOptions] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    let active = true;

    async function loadStaffOptions() {
      const response = await fetch("/api/staff", { cache: "no-store" });
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

    async function loadReport() {
      setLoading(true);
      setError(null);

      const [yearPart, monthPart] = monthInput.split("-").map((value) => Number(value));
      const params = new URLSearchParams({
        month: String(monthPart),
        year: String(yearPart),
      });

      if (staffFilter !== "ALL") {
        params.set("staffId", staffFilter);
      }

      const response = await fetch(`/api/attendance/reports?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as AttendanceReportResponse & { error?: string };

      if (!response.ok) {
        if (active) {
          setError(payload.error ?? "Unable to load reports.");
          setLoading(false);
        }
        return;
      }

      if (!active) {
        return;
      }

      setReport(payload);
      setLoading(false);
    }

    loadReport();

    return () => {
      active = false;
    };
  }, [monthInput, staffFilter]);

  function exportCsv() {
    if (!report || report.items.length === 0) {
      return;
    }

    const header = [
      "Staff",
      "Designation",
      ...report.days.map((day) => `${day.day} ${day.weekday}`),
      "Present",
      "Absent",
      "Leave",
      "Half Day",
      "Attendance %",
    ];

    const lines = report.items.map((item) => [
      item.name,
      item.designation,
      ...item.cells.map((cell) => statusCellLabel(cell.status)),
      String(item.summary.present),
      String(item.summary.absent),
      String(item.summary.leave),
      String(item.summary.halfDay),
      String(item.summary.attendancePercent),
    ]);

    const csvText = [header, ...lines]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const href = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = href;
    link.download = `attendance-${report.year}-${`${report.month}`.padStart(2, "0")}.csv`;
    link.click();

    URL.revokeObjectURL(href);
  }

  const calendarTarget = report?.items[0] ?? null;
  const calendarStatuses = useMemo(() => {
    if (!calendarTarget) {
      return {} as Record<number, CellStatus>;
    }

    return Object.fromEntries(calendarTarget.cells.map((cell) => [cell.day, cell.status])) as Record<number, CellStatus>;
  }, [calendarTarget]);

  const focusDayRows = useMemo(() => {
    if (!report || !focusDay) {
      return [];
    }

    return report.items.map((item) => {
      const cell = item.cells.find((entry) => entry.day === focusDay);
      return {
        staffId: item.staffId,
        name: item.name,
        designation: item.designation,
        status: cell?.status ?? "OFF",
      };
    });
  }, [report, focusDay]);

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <header className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Attendance Reports</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Monthly attendance analytics for your staff team.</p>
          </div>

          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700 hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <Download className="h-4 w-4" />
            Export to CSV
          </button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="month"
            value={monthInput}
            onChange={(event) => setMonthInput(event.target.value)}
            className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm"
          />

          <select
            value={staffFilter}
            onChange={(event) => setStaffFilter(event.target.value)}
            className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm"
          >
            <option value="ALL">All Staff</option>
            {staffOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-xl border border-[var(--border)] bg-white" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-xl border border-[var(--border)] bg-white" />
        </div>
      ) : !report || report.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-16 text-center">
          <p className="text-base font-semibold text-[var(--foreground)]">No staff found. Add staff first.</p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-[var(--border)] bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Working Days</p>
              <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{report.overview.workingDays}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Avg Attendance %</p>
              <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{report.overview.avgAttendancePercent}%</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Perfect Attendance</p>
              <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{report.overview.perfectAttendanceCount}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-white p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Most Absent</p>
              <p className="mt-2 text-lg font-bold text-[var(--foreground)]">{report.overview.mostAbsentStaff}</p>
            </div>
          </section>

          <section className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
            <table className="min-w-[1280px] w-full text-left text-xs">
              <thead className="bg-slate-50 uppercase tracking-[0.08em] text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2 text-sm">Staff</th>
                  {report.days.map((day) => (
                    <th key={day.day} className="px-2 py-2 text-center">
                      {day.weekday}
                      <br />
                      {day.day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.items.map((row) => (
                  <tr key={row.staffId} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{row.name}</p>
                      <p className="text-[11px] text-[var(--muted)]">{row.designation}</p>
                    </td>
                    {row.cells.map((cell) => (
                      <td key={`${row.staffId}-${cell.day}`} className="px-1 py-1 text-center">
                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full font-semibold ${statusCellClass(cell.status)}`}>
                          {statusCellLabel(cell.status)}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {calendarTarget ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Month Calendar: {calendarTarget.name}</h2>
              <MonthCalendar
                year={report.year}
                month={report.month}
                dayStatuses={calendarStatuses}
                selectedDay={focusDay}
                onDayClick={(day) => setFocusDay(day)}
              />

              {focusDay ? (
                <div className="rounded-xl border border-[var(--border)] bg-white p-4">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">Day {focusDay} Snapshot</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {focusDayRows.map((row) => (
                      <div key={`focus-${row.staffId}`} className="rounded-lg border border-[var(--border)] p-3">
                        <p className="text-sm font-semibold text-[var(--foreground)]">{row.name}</p>
                        <p className="text-xs text-[var(--muted)]">{row.designation}</p>
                        <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusCellClass(row.status)}`}>
                          {statusCellLabel(row.status)} {row.status === "OFF" ? "Off" : row.status.replaceAll("_", " ")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--foreground)]">Individual Staff Summary</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {report.items.map((row) => (
                <article key={`summary-${row.staffId}`} className="rounded-xl border border-[var(--border)] bg-white p-4">
                  <div className="flex items-center gap-3">
                    <StaffAvatar name={row.name} />
                    <div>
                      <p className="font-semibold text-[var(--foreground)]">{row.name}</p>
                      <p className="text-xs text-[var(--muted)]">{row.designation}</p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 text-sm">
                    <p className="flex justify-between"><span className="text-[var(--muted)]">Present days</span><span className="font-semibold">{row.summary.present}</span></p>
                    <p className="flex justify-between"><span className="text-[var(--muted)]">Absent days</span><span className="font-semibold">{row.summary.absent}</span></p>
                    <p className="flex justify-between"><span className="text-[var(--muted)]">Leave days</span><span className="font-semibold">{row.summary.leave}</span></p>
                    <p className="flex justify-between"><span className="text-[var(--muted)]">Attendance %</span><span className="font-semibold">{row.summary.attendancePercent}%</span></p>
                  </div>

                  <div className="mt-3 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${row.summary.attendancePercent}%` }} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
