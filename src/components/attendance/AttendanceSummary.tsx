import { ATTENDANCE_STATUS_VALUES, getAttendanceStatusStyle, type AttendanceStatusValue } from "@/lib/attendanceStatus";

type AttendanceSummaryProps = {
  counts: Record<AttendanceStatusValue, number>;
  title?: string;
  totalOverride?: number;
  notMarked?: number;
};

function percentage(value: number, total: number) {
  if (total === 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

export function AttendanceSummary({ counts, title = "Today's Summary", totalOverride, notMarked = 0 }: AttendanceSummaryProps) {
  const countedTotal = ATTENDANCE_STATUS_VALUES.reduce((sum, key) => sum + counts[key], 0) + notMarked;
  const total = totalOverride ?? countedTotal;

  const bars = ATTENDANCE_STATUS_VALUES.map((key) => ({ key, style: getAttendanceStatusStyle(key) }));

  return (
    <aside className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <h2 className="text-base font-semibold text-[var(--foreground)]">{title}</h2>

      <div className="mt-4 space-y-2 text-sm">
        {bars.map(({ key, style }) => (
          <p key={key} className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${style.dotClassName}`} />
              {style.label}
            </span>
            <span className="font-semibold text-[var(--foreground)]">{counts[key]}</span>
          </p>
        ))}
        {notMarked > 0 ? (
          <p className="flex items-center justify-between text-[var(--muted)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              Not Marked
            </span>
            <span className="font-semibold">{notMarked}</span>
          </p>
        ) : null}
      </div>

      <div className="my-3 border-t border-dashed border-[var(--border)]" />

      <p className="flex items-center justify-between text-sm">
        <span className="text-[var(--muted)]">Total</span>
        <span className="font-semibold text-[var(--foreground)]">{total}</span>
      </p>

      <div className="mt-4 space-y-2">
        {bars.map(({ key, style }) => {
          const value = counts[key];
          const width = percentage(value, total);

          return (
            <div key={key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-[var(--muted)]">{style.label}</span>
                <span className="text-[var(--muted)]">{width}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className={`h-2 rounded-full ${style.dotClassName}`} style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
