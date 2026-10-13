import { Save } from "lucide-react";

import { ATTENDANCE_STATUS_VALUES, getAttendanceStatusStyle, type AttendanceStatusValue } from "@/lib/attendanceStatus";

type AttendanceRow = {
  staffId: string;
  name: string;
  designation: string;
  status: AttendanceStatusValue | null;
  displayStatus: AttendanceStatusValue | "NOT_MARKED";
};

type AttendanceTableProps = {
  rows: AttendanceRow[];
  pendingStatuses: Record<string, AttendanceStatusValue>;
  savingAll: boolean;
  onMarkAll: (status: AttendanceStatusValue) => void;
  onStatusChange: (staffId: string, status: AttendanceStatusValue) => void;
  onSaveAll: () => void;
  hasUnsavedChanges: boolean;
};

function statusWithFallback(row: AttendanceRow, pending: AttendanceStatusValue | undefined): AttendanceStatusValue {
  if (pending) {
    return pending;
  }

  if (row.status) {
    return row.status;
  }

  // No stored row yet: default the dropdown to what will actually be saved
  // if "Save Attendance" is clicked without any further changes — an
  // automatic Week Off on a closed day, or Present as the usual daily guess.
  return row.displayStatus === "WEEK_OFF" ? "WEEK_OFF" : "PRESENT";
}

export function AttendanceTable({
  rows,
  pendingStatuses,
  savingAll,
  onMarkAll,
  onStatusChange,
  onSaveAll,
  hasUnsavedChanges,
}: AttendanceTableProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-white p-3">
        <button
          type="button"
          onClick={() => onMarkAll("PRESENT")}
          className="inline-flex h-9 items-center rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-emerald-700"
        >
          Mark all Present
        </button>

        <button
          type="button"
          onClick={() => onMarkAll("ABSENT")}
          className="inline-flex h-9 items-center rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700"
        >
          Mark all Absent
        </button>

        <button
          type="button"
          onClick={() => onMarkAll("WEEK_OFF")}
          className="inline-flex h-9 items-center rounded-lg border border-indigo-200 px-3 text-xs font-semibold text-indigo-700"
        >
          Mark all Week Off
        </button>

        <button
          type="button"
          onClick={onSaveAll}
          disabled={savingAll || !hasUnsavedChanges}
          className="ml-auto inline-flex h-9 items-center gap-1 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white disabled:opacity-60"
        >
          <Save className="h-3.5 w-3.5" />
          {savingAll ? "Saving..." : "Save Attendance"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
        <table className="min-w-[640px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Staff Member</th>
              <th className="px-4 py-3">Designation</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const current = statusWithFallback(row, pendingStatuses[row.staffId]);
              const style = getAttendanceStatusStyle(current);

              return (
                <tr key={row.staffId} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${style.dotClassName}`} />
                      <span className="font-semibold text-[var(--foreground)]">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{row.designation}</td>
                  <td className="px-4 py-3">
                    <label className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-2.5 py-1.5">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${style.dotClassName}`} />
                      <select
                        value={current}
                        onChange={(event) => onStatusChange(row.staffId, event.target.value as AttendanceStatusValue)}
                        className="bg-transparent text-sm font-medium text-[var(--foreground)] outline-none"
                      >
                        {ATTENDANCE_STATUS_VALUES.map((value) => (
                          <option key={value} value={value}>
                            {getAttendanceStatusStyle(value).label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
