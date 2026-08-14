"use client";

type DateRange = {
  startDate: string;
  endDate: string;
};

type DateRangePickerProps = {
  value: DateRange;
  onChange: (next: DateRange) => void;
};

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function quickRange(type: "today" | "week" | "month" | "year") {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (type === "week") {
    const day = now.getDay();
    const offset = (day + 6) % 7;
    start.setDate(now.getDate() - offset);
  } else if (type === "month") {
    start.setDate(1);
  } else if (type === "year") {
    start.setMonth(0, 1);
  }

  return {
    startDate: toDateString(start),
    endDate: toDateString(end),
  };
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        type="date"
        value={value.startDate}
        onChange={(event) => onChange({ ...value, startDate: event.target.value })}
        className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm"
      />
      <input
        type="date"
        value={value.endDate}
        onChange={(event) => onChange({ ...value, endDate: event.target.value })}
        className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm"
      />

      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-[var(--border)] p-1">
        <button type="button" onClick={() => onChange(quickRange("today"))} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">Today</button>
        <button type="button" onClick={() => onChange(quickRange("week"))} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">Week</button>
        <button type="button" onClick={() => onChange(quickRange("month"))} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">Month</button>
        <button type="button" onClick={() => onChange(quickRange("year"))} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">Year</button>
      </div>
    </div>
  );
}
