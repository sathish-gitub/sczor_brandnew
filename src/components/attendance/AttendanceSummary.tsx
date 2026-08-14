type AttendanceStatus = "PRESENT" | "ABSENT" | "LEAVE" | "HALF_DAY";

type AttendanceSummaryProps = {
  counts: Record<AttendanceStatus, number>;
  title?: string;
  totalOverride?: number;
};

function percentage(value: number, total: number) {
  if (total === 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

export function AttendanceSummary({ counts, title = "Today's Summary", totalOverride }: AttendanceSummaryProps) {
  const countedTotal = counts.PRESENT + counts.ABSENT + counts.LEAVE + counts.HALF_DAY;
  const total = totalOverride ?? countedTotal;

  const bars = [
    { label: "Present", key: "PRESENT", color: "bg-emerald-500", text: "text-emerald-700" },
    { label: "Absent", key: "ABSENT", color: "bg-red-500", text: "text-red-700" },
    { label: "Leave", key: "LEAVE", color: "bg-yellow-500", text: "text-yellow-700" },
    { label: "Half Day", key: "HALF_DAY", color: "bg-orange-500", text: "text-orange-700" },
  ] as const;

  return (
    <aside className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <h2 className="text-base font-semibold text-[var(--foreground)]">{title}</h2>

      <div className="mt-4 space-y-2 text-sm">
        <p className="flex items-center justify-between">
          <span className="text-emerald-700">Present</span>
          <span className="font-semibold text-[var(--foreground)]">{counts.PRESENT}</span>
        </p>
        <p className="flex items-center justify-between">
          <span className="text-red-700">Absent</span>
          <span className="font-semibold text-[var(--foreground)]">{counts.ABSENT}</span>
        </p>
        <p className="flex items-center justify-between">
          <span className="text-yellow-700">Leave</span>
          <span className="font-semibold text-[var(--foreground)]">{counts.LEAVE}</span>
        </p>
        <p className="flex items-center justify-between">
          <span className="text-orange-700">Half Day</span>
          <span className="font-semibold text-[var(--foreground)]">{counts.HALF_DAY}</span>
        </p>
      </div>

      <div className="my-3 border-t border-dashed border-[var(--border)]" />

      <p className="flex items-center justify-between text-sm">
        <span className="text-[var(--muted)]">Total</span>
        <span className="font-semibold text-[var(--foreground)]">{total}</span>
      </p>

      <div className="mt-4 space-y-2">
        {bars.map((bar) => {
          const value = counts[bar.key];
          const width = percentage(value, total);

          return (
            <div key={bar.key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className={bar.text}>{bar.label}</span>
                <span className="text-[var(--muted)]">{width}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className={`h-2 rounded-full ${bar.color}`} style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
