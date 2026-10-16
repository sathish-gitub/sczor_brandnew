import { ATTENDANCE_STATUS_VALUES, getAttendanceStatusStyle, type AttendanceStatusValue } from "@/lib/attendanceStatus";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, Check, CheckCircle2 } from "lucide-react";

type AttendanceRow = {
  staffId: string;
  name: string;
  designation: string;
  status: AttendanceStatusValue | null;
  displayStatus: AttendanceStatusValue | "NOT_MARKED";
};

type RowSaveState = "idle" | "saving" | "saved" | "error";

type AttendanceTableProps = {
  rows: AttendanceRow[];
  pendingStatuses: Record<string, AttendanceStatusValue>;
  onMarkAll: (status: AttendanceStatusValue) => void;
  onStatusChange: (staffId: string, status: AttendanceStatusValue) => void;
  onAutoSave: (staffId: string, status: AttendanceStatusValue) => Promise<boolean>;
  isReadOnly?: boolean;
};

function statusWithFallback(row: AttendanceRow, pending: AttendanceStatusValue | undefined): AttendanceStatusValue {
  if (pending) {
    return pending;
  }

  if (row.status) {
    return row.status;
  }

  return row.displayStatus === "WEEK_OFF" ? "WEEK_OFF" : "PRESENT";
}

export function AttendanceTable({
  rows,
  pendingStatuses,
  onMarkAll,
  onStatusChange,
  onAutoSave,
  isReadOnly = false,
}: AttendanceTableProps) {
  const [rowSaveStates, setRowSaveStates] = useState<Record<string, RowSaveState>>({});
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const totalSavingCount = useMemo(
    () => Object.values(rowSaveStates).filter((state) => state === "saving").length,
    [rowSaveStates],
  );

  // "Not marked" covers only the staff currently shown (the `rows` passed in already
  // reflect the staff filter and search). A row just changed via the dropdown (an
  // entry in `pendingStatuses`) counts as marked immediately for a live badge, even
  // before the debounced save confirms — matching the per-row status shown below.
  const unmarkedCount = useMemo(
    () =>
      rows.filter((row) => !pendingStatuses[row.staffId] && !row.status && row.displayStatus === "NOT_MARKED").length,
    [rows, pendingStatuses],
  );

  const handleStatusChange = useCallback(
    (staffId: string, status: AttendanceStatusValue) => {
      onStatusChange(staffId, status);
      setRowSaveStates((prev) => ({ ...prev, [staffId]: "saving" }));

      // Clear previous timer
      if (debounceTimers.current[staffId]) {
        clearTimeout(debounceTimers.current[staffId]);
      }

      // Set new timer
      debounceTimers.current[staffId] = setTimeout(async () => {
        const success = await onAutoSave(staffId, status);
        setRowSaveStates((prev) => ({
          ...prev,
          [staffId]: success ? "saved" : "error",
        }));

        // Fade out "Saved" after 2 seconds
        if (success) {
          setTimeout(() => {
            setRowSaveStates((prev) => ({
              ...prev,
              [staffId]: "idle",
            }));
          }, 2000);
        }
      }, 400);
    },
    [onStatusChange, onAutoSave],
  );

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-white p-3">
        <button
          type="button"
          onClick={() => onMarkAll("PRESENT")}
          disabled={isReadOnly}
          className="inline-flex h-9 items-center rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-emerald-700 disabled:opacity-50"
        >
          Mark all Present
        </button>

        <button
          type="button"
          onClick={() => onMarkAll("ABSENT")}
          disabled={isReadOnly}
          className="inline-flex h-9 items-center rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 disabled:opacity-50"
        >
          Mark all Absent
        </button>

        <button
          type="button"
          onClick={() => onMarkAll("WEEK_OFF")}
          disabled={isReadOnly}
          className="inline-flex h-9 items-center rounded-lg border border-indigo-200 px-3 text-xs font-semibold text-indigo-700 disabled:opacity-50"
        >
          Mark all Week Off
        </button>

        <div className="ml-auto text-xs font-medium">
          {totalSavingCount > 0 ? (
            <span className="text-amber-700">Saving {totalSavingCount} changes...</span>
          ) : unmarkedCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-red-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              Attendance Not Marked ({unmarkedCount} of {rows.length})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Attendance Marked
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
        <table className="min-w-[640px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Staff Member</th>
              <th className="px-4 py-3">Designation</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Remark</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const current = statusWithFallback(row, pendingStatuses[row.staffId]);
              const style = getAttendanceStatusStyle(current);
              const saveState = rowSaveStates[row.staffId] ?? "idle";

              const isMarked = pendingStatuses[row.staffId] || row.status || row.displayStatus === "WEEK_OFF";
              const remarkText = isMarked ? "Marked" : "Not Marked";
              const remarkTextColor = isMarked ? "text-emerald-700" : "text-red-700";

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
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-2.5 py-1.5">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${style.dotClassName}`} />
                        <select
                          value={current}
                          onChange={(event) => handleStatusChange(row.staffId, event.target.value as AttendanceStatusValue)}
                          disabled={isReadOnly}
                          className="bg-transparent text-sm font-medium text-[var(--foreground)] outline-none disabled:opacity-50"
                        >
                          {ATTENDANCE_STATUS_VALUES.map((value) => (
                            <option key={value} value={value}>
                              {getAttendanceStatusStyle(value).label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="min-w-[80px] text-xs font-medium">
                        {saveState === "saving" ? (
                          <span className="text-amber-700">Saving...</span>
                        ) : saveState === "saved" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <Check className="h-3 w-3" />
                            Saved
                          </span>
                        ) : saveState === "error" ? (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(row.staffId, current)}
                            className="text-red-700 hover:underline"
                          >
                            <AlertCircle className="inline h-3 w-3 mr-1" />
                            Failed, tap to retry
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold ${remarkTextColor}`}>{remarkText}</span>
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
