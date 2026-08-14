import { CheckCircle2, Save } from "lucide-react";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LEAVE" | "HALF_DAY";

type AttendanceRow = {
  staffId: string;
  name: string;
  designation: string;
  status: AttendanceStatus | null;
};

type AttendanceTableProps = {
  rows: AttendanceRow[];
  selectedIds: Set<string>;
  pendingStatuses: Record<string, AttendanceStatus>;
  savingIds: Set<string>;
  savingAll: boolean;
  onToggleSelect: (staffId: string) => void;
  onSelectAll: () => void;
  onMarkAll: (status: AttendanceStatus) => void;
  onStatusChange: (staffId: string, status: AttendanceStatus) => void;
  onSaveSingle: (staffId: string) => void;
  onSaveAll: () => void;
};

const statusOptions: Array<{ value: AttendanceStatus; label: string; dot: string }> = [
  { value: "PRESENT", label: "Present", dot: "bg-emerald-500" },
  { value: "ABSENT", label: "Absent", dot: "bg-red-500" },
  { value: "LEAVE", label: "Leave", dot: "bg-yellow-500" },
  { value: "HALF_DAY", label: "Half Day", dot: "bg-orange-500" },
];

function statusWithFallback(status: AttendanceStatus | null, pending: AttendanceStatus | undefined) {
  return pending ?? status ?? "PRESENT";
}

function statusColor(status: AttendanceStatus) {
  if (status === "PRESENT") {
    return "bg-emerald-500";
  }

  if (status === "ABSENT") {
    return "bg-red-500";
  }

  if (status === "LEAVE") {
    return "bg-yellow-500";
  }

  return "bg-orange-500";
}

export function AttendanceTable({
  rows,
  selectedIds,
  pendingStatuses,
  savingIds,
  savingAll,
  onToggleSelect,
  onSelectAll,
  onMarkAll,
  onStatusChange,
  onSaveSingle,
  onSaveAll,
}: AttendanceTableProps) {
  const allSelected = rows.length > 0 && selectedIds.size === rows.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-white p-3">
        <button
          type="button"
          onClick={onSelectAll}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-slate-700"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {allSelected ? "Unselect All" : "Select All"}
        </button>

        <button
          type="button"
          onClick={() => onMarkAll("PRESENT")}
          className="inline-flex h-9 items-center rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-emerald-700"
        >
          Mark All Present
        </button>

        <button
          type="button"
          onClick={() => onMarkAll("ABSENT")}
          className="inline-flex h-9 items-center rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700"
        >
          Mark All Absent
        </button>

        <button
          type="button"
          onClick={onSaveAll}
          disabled={savingAll}
          className="inline-flex h-9 items-center gap-1 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white disabled:opacity-60"
        >
          <Save className="h-3.5 w-3.5" />
          {savingAll ? "Saving..." : "Save All Changes"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
        <table className="min-w-[780px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Select</th>
              <th className="px-4 py-3">Staff Member</th>
              <th className="px-4 py-3">Designation</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const current = statusWithFallback(row.status, pendingStatuses[row.staffId]);

              return (
                <tr key={row.staffId} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.staffId)}
                      onChange={() => onToggleSelect(row.staffId)}
                      className="h-4 w-4 rounded border-[var(--border)]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusColor(current)}`} />
                      <span className="font-semibold text-[var(--foreground)]">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{row.designation}</td>
                  <td className="px-4 py-3">
                    <label className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-2.5 py-1.5">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusColor(current)}`} />
                      <select
                        value={current}
                        onChange={(event) => onStatusChange(row.staffId, event.target.value as AttendanceStatus)}
                        className="bg-transparent text-sm font-medium text-[var(--foreground)] outline-none"
                      >
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onSaveSingle(row.staffId)}
                      disabled={savingIds.has(row.staffId)}
                      className="inline-flex h-8 items-center rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-slate-700 disabled:opacity-60"
                    >
                      {savingIds.has(row.staffId) ? "Saving..." : "Save"}
                    </button>
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
