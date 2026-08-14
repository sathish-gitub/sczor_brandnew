type AttendanceStatus = "PRESENT" | "ABSENT" | "LEAVE" | "HALF_DAY" | "OFF";

type MonthCalendarProps = {
  year: number;
  month: number;
  dayStatuses: Record<number, AttendanceStatus>;
  selectedDay?: number;
  onDayClick?: (day: number) => void;
};

const weekdayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function colorFor(status: AttendanceStatus | undefined) {
  if (status === "PRESENT") {
    return "bg-emerald-100 text-emerald-700 border-emerald-200";
  }

  if (status === "ABSENT") {
    return "bg-red-100 text-red-700 border-red-200";
  }

  if (status === "LEAVE") {
    return "bg-yellow-100 text-yellow-700 border-yellow-200";
  }

  if (status === "HALF_DAY") {
    return "bg-orange-100 text-orange-700 border-orange-200";
  }

  return "bg-slate-100 text-slate-500 border-slate-200";
}

function shortStatus(status: AttendanceStatus | undefined) {
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

          const status = dayStatuses[day];
          const active = selectedDay === day;

          return (
            <button
              key={day}
              type="button"
              onClick={() => onDayClick?.(day)}
              className={[
                "h-14 rounded-lg border text-left text-xs",
                colorFor(status),
                active ? "ring-2 ring-slate-900" : "",
              ].join(" ")}
            >
              <div className="px-2 pt-1">
                <p className="font-semibold">{day}</p>
                <p className="mt-1 text-[11px]">{shortStatus(status)}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">P Present</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-red-700">A Absent</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-yellow-700">L Leave</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-1 text-orange-700">H Half Day</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-600">- Off</span>
      </div>
    </section>
  );
}
