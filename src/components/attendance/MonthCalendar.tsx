import { getAttendanceStatusStyle, type DisplayAttendanceStatus } from "@/lib/attendanceStatus";

type MonthCalendarProps = {
  year: number;
  month: number;
  dayStatuses: Record<number, DisplayAttendanceStatus>;
  selectedDay?: number;
  onDayClick?: (day: number) => void;
};

const weekdayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const LEGEND_STATUSES: DisplayAttendanceStatus[] = ["PRESENT", "ABSENT", "LEAVE", "WEEK_OFF", "HALF_DAY", "NOT_MARKED"];

export function MonthCalendar({ year, month, dayStatuses, selectedDay, onDayClick }: MonthCalendarProps) {
  const first = new Date(year, month - 1, 1);
  const offset = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;

  const cells = Array.from({ length: totalCells }).map((_, index) => {
    const day = index - offset + 1;

    if (day < 1 || day > daysInMonth) {
      return null;
    }

    return day;
  });

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
        {weekdayHeaders.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="h-14 rounded-lg bg-slate-50" />;
          }

          const style = getAttendanceStatusStyle(dayStatuses[day]);
          const active = selectedDay === day;

          return (
            <button
              key={day}
              type="button"
              onClick={() => onDayClick?.(day)}
              className={[
                "h-14 rounded-lg border text-left text-xs",
                style.cellClassName,
                "border-transparent",
                active ? "ring-2 ring-slate-900" : "",
              ].join(" ")}
            >
              <div className="px-2 pt-1">
                <p className="font-semibold">{day}</p>
                <p className="mt-1 text-[11px]">{style.shortLabel}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {LEGEND_STATUSES.map((status) => {
          const style = getAttendanceStatusStyle(status);
          return (
            <span key={status} className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${style.badgeClassName}`}>
              {style.shortLabel} {style.label}
            </span>
          );
        })}
      </div>
    </section>
  );
}
