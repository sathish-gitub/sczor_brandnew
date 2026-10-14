"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ExportButtons } from "@/components/reports/ExportButtons";
import { FilterChips } from "@/components/reports/FilterChips";
import { MonthCalendar } from "@/components/attendance/MonthCalendar";
import { StaffAvatar } from "@/components/staff/StaffAvatar";
import { useAccess } from "@/contexts/AccessContext";
import type { ExportColumn } from "@/lib/exportReport";
import { formatFiltersLabel, formatPeriodRange, toExportSalonDetails } from "@/lib/exportReport";
import { getAttendanceStatusStyle, type DisplayAttendanceStatus } from "@/lib/attendanceStatus";
import { currentISTMonthYear, daysInMonthIST } from "@/lib/time";

type CellStatus = DisplayAttendanceStatus;

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
    weekOff: number;
    attendancePercent: number;
  };
};

type AttendanceReportResponse = {
  month: number;
  year: number;
  days: Array<{ day: number; weekday: string; isBusinessWorkingDay: boolean }>;
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

export default function AttendanceReportsPage() {
  const access = useAccess();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const istDefaults = useMemo(() => currentISTMonthYear(), []);
  const monthParam = searchParams.get("month");
  const monthInput =
    monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : formatMonthInput(istDefaults.year, istDefaults.month);
  const staffFilter = searchParams.get("staffId") ?? "ALL";
  const [searchQuery, setSearchQuery] = useState("");
  const [focusDay, setFocusDay] = useState<number | undefined>(undefined);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AttendanceReportResponse | null>(null);

  const [staffOptions, setStaffOptions] = useState<Array<{ id: string; name: string; designation: string }>>([]);

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
      const response = await fetch("/api/staff", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | { items?: Array<{ id: string; name: string; designation: string }> }
        | null;

      if (!active) {
        return;
      }

      setStaffOptions(
        payload?.items?.map((item) => ({ id: item.id, name: item.name, designation: item.designation ?? "" })) ?? [],
      );
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

  const visibleItems = useMemo(() => {
    if (!report) {
      return [];
    }

    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return report.items;
    }

    return report.items.filter(
      (item) => item.name.toLowerCase().includes(query) || item.designation.toLowerCase().includes(query),
    );
  }, [report, searchQuery]);

  function getAttendanceExportConfig() {
    if (!report) {
      return {
        title: "Attendance Report",
        salon: toExportSalonDetails(access),
        columns: [{ header: "Staff", key: "name", type: "text" as const }],
        rows: [],
        filename: "sczor-attendance-report",
      };
    }

    const dayColumns: ExportColumn[] = report.days.map((day) => ({
      header: `${day.day} ${day.weekday}`,
      key: `day${day.day}`,
      type: "text",
      width: 8,
    }));

    const columns: ExportColumn[] = [
      { header: "Staff", key: "name", type: "text" },
      { header: "Designation", key: "designation", type: "text" },
      ...dayColumns,
      { header: "Present", key: "present", type: "number" },
      { header: "Absent", key: "absent", type: "number" },
      { header: "Leave", key: "leave", type: "number" },
      { header: "Week Off", key: "weekOff", type: "number" },
      { header: "Half Day", key: "halfDay", type: "number" },
      { header: "Attendance %", key: "attendancePercent", type: "percent" },
    ];

    const rows = visibleItems.map((item) => {
      const row: Record<string, unknown> = {
        name: item.name,
        designation: item.designation,
        present: item.summary.present,
        absent: item.summary.absent,
        leave: item.summary.leave,
        weekOff: item.summary.weekOff,
        halfDay: item.summary.halfDay,
        attendancePercent: item.summary.attendancePercent,
      };

      item.cells.forEach((cell) => {
        row[`day${cell.day}`] = getAttendanceStatusStyle(cell.status).shortLabel;
      });

      return row;
    });

    return {
      title: "Attendance Report",
      salon: toExportSalonDetails(access),
      ...formatPeriodRange(
        `${report.year}-${String(report.month).padStart(2, "0")}-01`,
        `${report.year}-${String(report.month).padStart(2, "0")}-${String(daysInMonthIST(report.year, report.month)).padStart(2, "0")}`,
      ),
      filtersLabel: formatFiltersLabel([
        staffFilter !== "ALL" ? { label: "Staff", value: staffOptions.find((s) => s.id === staffFilter)?.name ?? staffFilter } : null,
      ]),
      generatedBy: access.userName,
      summary: [
        { label: "Total Present", value: visibleItems.reduce((sum, item) => sum + item.summary.present, 0), type: "number" as const },
        { label: "Total Absent", value: visibleItems.reduce((sum, item) => sum + item.summary.absent, 0), type: "number" as const },
        { label: "Total Leave", value: visibleItems.reduce((sum, item) => sum + item.summary.leave, 0), type: "number" as const },
        { label: "Total Week Off", value: visibleItems.reduce((sum, item) => sum + item.summary.weekOff, 0), type: "number" as const },
      ],
      columns,
      rows,
      filename: `sczor-attendance-${report.year}-${String(report.month).padStart(2, "0")}`,
    };
  }

  const calendarTarget = visibleItems[0] ?? null;
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

    return visibleItems.map((item) => {
      const cell = item.cells.find((entry) => entry.day === focusDay);
      return {
        staffId: item.staffId,
        name: item.name,
        designation: item.designation,
        status: (cell?.status ?? "NOT_MARKED") as CellStatus,
      };
    });
  }, [report, focusDay, visibleItems]);

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <header className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Attendance Reports</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Monthly attendance analytics for your staff team.</p>
          </div>

          <div className="flex items-center gap-2">
            <FilterChips
              chips={[
                staffFilter !== "ALL"
                  ? {
                      label: "Staff",
                      value: staffOptions.find((s) => s.id === staffFilter)?.name ?? staffFilter,
                      onClear: () => updateQuery({ staffId: null }),
                    }
                  : null,
              ]}
            />
            <ExportButtons getConfig={getAttendanceExportConfig} disabled={!report} />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="month"
            value={monthInput}
            onChange={(event) => updateQuery({ month: event.target.value })}
            className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm"
          />

          <select
            value={staffFilter}
            onChange={(event) => updateQuery({ staffId: event.target.value === "ALL" ? null : event.target.value })}
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
      ) : visibleItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-16 text-center">
          <p className="text-base font-semibold text-[var(--foreground)]">No staff match &quot;{searchQuery}&quot;.</p>
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
                {visibleItems.map((row) => (
                  <tr key={row.staffId} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{row.name}</p>
                      <p className="text-[11px] text-[var(--muted)]">{row.designation}</p>
                    </td>
                    {row.cells.map((cell) => {
                      const style = getAttendanceStatusStyle(cell.status);
                      return (
                        <td key={`${row.staffId}-${cell.day}`} className="px-1 py-1 text-center">
                          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full font-semibold ${style.cellClassName}`}>
                            {style.shortLabel}
                          </span>
                        </td>
                      );
                    })}
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
                    {focusDayRows.map((row) => {
                      const style = getAttendanceStatusStyle(row.status);
                      return (
                        <div key={`focus-${row.staffId}`} className="rounded-lg border border-[var(--border)] p-3">
                          <p className="text-sm font-semibold text-[var(--foreground)]">{row.name}</p>
                          <p className="text-xs text-[var(--muted)]">{row.designation}</p>
                          <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${style.badgeClassName}`}>
                            {style.shortLabel} {style.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--foreground)]">Individual Staff Summary</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleItems.map((row) => (
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
                    <p className="flex justify-between"><span className="text-[var(--muted)]">Week Off days</span><span className="font-semibold">{row.summary.weekOff}</span></p>
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
