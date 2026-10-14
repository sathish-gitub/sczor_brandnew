"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ExportButtons } from "@/components/reports/ExportButtons";
import { FilterChips } from "@/components/reports/FilterChips";
import { MonthCalendar } from "@/components/attendance/MonthCalendar";
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
  };
};

type AttendanceReportResponse = {
  month: number;
  year: number;
  days: Array<{ day: number; weekday: string; isBusinessWorkingDay: boolean }>;
  items: ReportRow[];
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Status codes shown in the compact matrix cells, in legend display order. */
const LEGEND_STATUSES: CellStatus[] = ["PRESENT", "ABSENT", "LEAVE", "WEEK_OFF", "HALF_DAY", "NOT_MARKED"];

const TOTAL_COLUMNS: Array<{ key: keyof ReportRow["summary"]; header: string; title: string }> = [
  { key: "present", header: "P", title: "Present" },
  { key: "absent", header: "A", title: "Absent" },
  { key: "leave", header: "L", title: "Leave" },
  { key: "weekOff", header: "WO", title: "Week Off" },
  { key: "halfDay", header: "HD", title: "Half Day" },
];

function formatMonthInput(year: number, month: number) {
  return `${year}-${`${month}`.padStart(2, "0")}`;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "staff";
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
  const isMatrixView = staffFilter === "ALL";
  const [searchQuery, setSearchQuery] = useState("");

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

  const selectedStaff = useMemo(() => {
    if (isMatrixView || !report) {
      return null;
    }

    return report.items[0] ?? null;
  }, [isMatrixView, report]);

  const selectedStaffStatuses = useMemo(() => {
    if (!selectedStaff) {
      return {} as Record<number, CellStatus>;
    }

    return Object.fromEntries(selectedStaff.cells.map((cell) => [cell.day, cell.status])) as Record<number, CellStatus>;
  }, [selectedStaff]);

  const monthLabel = report ? `${MONTH_NAMES[report.month - 1]} ${report.year}` : "";

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

    const periodLabels = formatPeriodRange(
      `${report.year}-${String(report.month).padStart(2, "0")}-01`,
      `${report.year}-${String(report.month).padStart(2, "0")}-${String(daysInMonthIST(report.year, report.month)).padStart(2, "0")}`,
    );

    const staffName = staffFilter !== "ALL" ? staffOptions.find((option) => option.id === staffFilter)?.name ?? staffFilter : null;

    const filtersLabel = formatFiltersLabel([
      { label: "Month", value: monthLabel },
      staffName ? { label: "Staff", value: staffName } : null,
    ]);

    // Matrix (all staff): every active staff member as a row and every day of
    // the month as a column, mirroring the on-screen matrix. Exports always
    // use the full staff list, ignoring the on-screen name/designation search.
    if (isMatrixView) {
      const dayColumns: ExportColumn[] = report.days.map((day) => ({
        header: String(day.day),
        key: `day${day.day}`,
        type: "text",
        width: 3,
      }));

      const columns: ExportColumn[] = [
        { header: "Staff", key: "name", type: "text", width: 16 },
        { header: "Designation", key: "designation", type: "text", width: 12 },
        ...dayColumns,
        { header: "Present", key: "present", type: "number", width: 6 },
        { header: "Absent", key: "absent", type: "number", width: 6 },
        { header: "Leave", key: "leave", type: "number", width: 6 },
        { header: "Week Off", key: "weekOff", type: "number", width: 7 },
        { header: "Half Day", key: "halfDay", type: "number", width: 6 },
      ];

      const rows = report.items.map((item) => {
        const row: Record<string, unknown> = {
          name: item.name,
          designation: item.designation,
          present: item.summary.present,
          absent: item.summary.absent,
          leave: item.summary.leave,
          weekOff: item.summary.weekOff,
          halfDay: item.summary.halfDay,
        };

        item.cells.forEach((cell) => {
          row[`day${cell.day}`] = getAttendanceStatusStyle(cell.status).shortLabel;
        });

        return row;
      });

      const legendRows = LEGEND_STATUSES.map((status) => {
        const style = getAttendanceStatusStyle(status);
        return { code: style.shortLabel, meaning: style.label };
      });

      return {
        title: "Attendance Report - Matrix",
        salon: toExportSalonDetails(access),
        ...periodLabels,
        filtersLabel,
        generatedBy: access.userName,
        summary: [
          { label: "Total Staff", value: report.items.length, type: "number" as const },
          { label: "Total Present", value: report.items.reduce((sum, item) => sum + item.summary.present, 0), type: "number" as const },
          { label: "Total Absent", value: report.items.reduce((sum, item) => sum + item.summary.absent, 0), type: "number" as const },
          { label: "Total Leave", value: report.items.reduce((sum, item) => sum + item.summary.leave, 0), type: "number" as const },
          { label: "Total Week Off", value: report.items.reduce((sum, item) => sum + item.summary.weekOff, 0), type: "number" as const },
        ],
        columns,
        rows,
        extraSections: [
          {
            title: "Legend",
            columns: [
              { header: "Code", key: "code", type: "text" as const },
              { header: "Meaning", key: "meaning", type: "text" as const },
            ],
            rows: legendRows,
          },
        ],
        filename: `sczor-attendance-matrix-${report.year}-${String(report.month).padStart(2, "0")}`,
      };
    }

    // Single staff: one row per calendar date with its weekday and status.
    const columns: ExportColumn[] = [
      { header: "Date", key: "date", type: "text", width: 12 },
      { header: "Weekday", key: "weekday", type: "text", width: 10 },
      { header: "Status", key: "status", type: "text", width: 14 },
      { header: "Notes", key: "notes", type: "text", width: 20 },
    ];

    const rows =
      selectedStaff?.cells.map((cell) => ({
        date: `${pad2(cell.day)}/${pad2(report.month)}/${report.year}`,
        weekday: cell.weekday,
        status: getAttendanceStatusStyle(cell.status).label,
        notes: "-",
      })) ?? [];

    return {
      title: `Attendance Report - ${selectedStaff?.name ?? "Staff"}`,
      salon: toExportSalonDetails(access),
      ...periodLabels,
      filtersLabel,
      generatedBy: access.userName,
      summary: selectedStaff
        ? [
            { label: "Present", value: selectedStaff.summary.present, type: "number" as const },
            { label: "Absent", value: selectedStaff.summary.absent, type: "number" as const },
            { label: "Leave", value: selectedStaff.summary.leave, type: "number" as const },
            { label: "Week Off", value: selectedStaff.summary.weekOff, type: "number" as const },
            { label: "Half Day", value: selectedStaff.summary.halfDay, type: "number" as const },
          ]
        : undefined,
      columns,
      rows,
      filename: `sczor-attendance-${slugify(selectedStaff?.name ?? "staff")}-${report.year}-${String(report.month).padStart(2, "0")}`,
    };
  }

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <header className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Attendance Reports</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Monthly attendance for your staff team.</p>
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

          {isMatrixView ? (
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by name or designation..."
              className="h-10 flex-1 rounded-xl border border-[var(--border)] px-3 text-sm"
            />
          ) : null}
        </div>
      </header>

      {loading ? (
        <div className="space-y-4">
          <div className="h-72 animate-pulse rounded-xl border border-[var(--border)] bg-white" />
        </div>
      ) : !report || report.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-16 text-center">
          <p className="text-base font-semibold text-[var(--foreground)]">
            {isMatrixView ? "No active staff found. Add staff first." : "Staff member not found."}
          </p>
        </div>
      ) : isMatrixView ? (
        visibleItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-16 text-center">
            <p className="text-base font-semibold text-[var(--foreground)]">No staff match &quot;{searchQuery}&quot;.</p>
          </div>
        ) : (
          <section className="space-y-3">
            <div className="relative max-h-[70vh] overflow-auto rounded-xl border border-[var(--border)] bg-white">
              <table className="w-max table-fixed border-collapse text-xs">
                <colgroup>
                  <col className="w-40" />
                  {report.days.map((day) => (
                    <col key={`col-${day.day}`} className="w-8" />
                  ))}
                  {TOTAL_COLUMNS.map((column) => (
                    <col key={`col-total-${column.key}`} className="w-12" />
                  ))}
                </colgroup>
                <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.06em] text-[var(--muted)]">
                  <tr>
                    <th className="sticky left-0 top-0 z-30 border-b border-[var(--border)] bg-slate-50 px-3 py-2 text-left">
                      Staff
                    </th>
                    {report.days.map((day) => (
                      <th
                        key={day.day}
                        className={[
                          "sticky top-0 z-20 border-b border-[var(--border)] px-1 py-2 text-center font-semibold",
                          day.isBusinessWorkingDay ? "bg-slate-50" : "bg-slate-200",
                        ].join(" ")}
                      >
                        {day.day}
                      </th>
                    ))}
                    {TOTAL_COLUMNS.map((column) => (
                      <th
                        key={column.key}
                        title={column.title}
                        className="sticky top-0 z-20 border-b border-[var(--border)] bg-slate-50 px-1 py-2 text-center font-semibold"
                      >
                        {column.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((row) => (
                    <tr key={row.staffId} className="border-t border-[var(--border)]">
                      <td className="sticky left-0 z-10 border-r border-[var(--border)] bg-white px-3 py-2 text-left">
                        <p className="truncate text-sm font-semibold text-[var(--foreground)]">{row.name}</p>
                        <p className="truncate text-[11px] text-[var(--muted)]">{row.designation}</p>
                      </td>
                      {row.cells.map((cell) => {
                        const style = getAttendanceStatusStyle(cell.status);
                        const column = report.days[cell.day - 1];
                        return (
                          <td
                            key={`${row.staffId}-${cell.day}`}
                            className={["px-1 py-1 text-center", column && !column.isBusinessWorkingDay ? "bg-slate-50" : ""].join(
                              " ",
                            )}
                          >
                            <span
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${style.cellClassName}`}
                            >
                              {style.shortLabel}
                            </span>
                          </td>
                        );
                      })}
                      {TOTAL_COLUMNS.map((column) => (
                        <td key={column.key} className="px-1 py-1 text-center text-sm font-semibold text-[var(--foreground)]">
                          {row.summary[column.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              {LEGEND_STATUSES.map((status) => {
                const style = getAttendanceStatusStyle(status);
                return (
                  <span key={status} className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${style.badgeClassName}`}>
                    {style.shortLabel} {style.label}
                  </span>
                );
              })}
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-1 text-slate-600">
                Shaded column = non-working day
              </span>
            </div>
          </section>
        )
      ) : selectedStaff ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">{selectedStaff.name}</h2>
            <p className="text-sm text-[var(--muted)]">{selectedStaff.designation}</p>
          </div>

          <MonthCalendar year={report.year} month={report.month} dayStatuses={selectedStaffStatuses} />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: "Present", value: selectedStaff.summary.present },
              { label: "Absent", value: selectedStaff.summary.absent },
              { label: "Leave", value: selectedStaff.summary.leave },
              { label: "Week Off", value: selectedStaff.summary.weekOff },
              { label: "Half Day", value: selectedStaff.summary.halfDay },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-[var(--border)] bg-white p-4">
                <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">{item.label}</p>
                <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{item.value}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
