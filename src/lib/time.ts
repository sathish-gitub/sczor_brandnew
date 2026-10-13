/**
 * Centralized Asia/Kolkata ("IST") date/time helpers.
 *
 * The production server runs in UTC while development happens in IST, and
 * `Appointment.appointmentDate` is stored as a UTC instant representing an
 * IST calendar date at 00:00 IST. Any code that reads, compares, stores, or
 * displays appointment dates/times must go through these helpers instead of
 * bare `Date` methods (which are sensitive to the host process timezone).
 */

export const IST_TIME_ZONE = "Asia/Kolkata";

const IST_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: IST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const IST_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: IST_TIME_ZONE,
  weekday: "short",
});

const IST_DDMMYYYY_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: IST_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const IST_HHMM_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: IST_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const IST_TIME_12H_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: IST_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const IST_HHMMSS_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: IST_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const IST_DATETIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: IST_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const IST_DAY_MONTH_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: IST_TIME_ZONE,
  day: "numeric",
  month: "long",
});

const SUN_FIRST_WEEKDAY_INDEX: Record<"Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat", number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** "YYYY-MM-DD" (IST calendar date) for a given instant. en-CA locale formats as YYYY-MM-DD. */
export function toISTDateString(date: Date): string {
  return IST_DATE_FORMATTER.format(date);
}

/** Today's date as "YYYY-MM-DD" in IST, regardless of the host process timezone. */
export function todayISTDateString(): string {
  return toISTDateString(new Date());
}

/** Short weekday ("Mon".."Sun") for an instant, evaluated in IST. Matches Tenant/Staff `workingDays` values. */
export function toISTWeekday(date: Date): "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun" {
  return IST_WEEKDAY_FORMATTER.format(date) as "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
}

/** Minutes since midnight for the current instant's IST wall-clock time (e.g. for a "now" line on a day grid). */
export function nowISTMinutesOfDay(): number {
  const [hh, mm] = IST_HHMM_FORMATTER.format(new Date()).split(":").map(Number);
  return hh * 60 + mm;
}

/**
 * Build the absolute UTC instant for an IST wall-clock date + time.
 * `dateStr` is "YYYY-MM-DD", `time` is "HH:mm". Asia/Kolkata has a fixed
 * +05:30 offset (no DST), so an explicit-offset ISO string is always correct
 * irrespective of the host process timezone.
 */
export function istWallTimeToInstant(dateStr: string, time: string = "00:00"): Date {
  return new Date(`${dateStr}T${time}:00+05:30`);
}

/** [start, end) instants spanning one IST calendar day, for Prisma date-range queries. */
export function istDayBounds(dateStr: string): { start: Date; end: Date } {
  const start = istWallTimeToInstant(dateStr, "00:00");
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

const IST_WEEKDAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** [start, end) instants spanning the Mon-Sun IST calendar week containing `dateStr`. */
export function istWeekBounds(dateStr: string): { start: Date; end: Date } {
  const anchor = istWallTimeToInstant(dateStr, "00:00");
  const weekdayIndex = IST_WEEKDAY_ORDER.indexOf(toISTWeekday(anchor));
  const start = new Date(anchor.getTime() - weekdayIndex * 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { start, end };
}

/** [start, end) instants spanning the IST calendar month containing `dateStr`. */
export function istMonthBounds(dateStr: string): { start: Date; end: Date } {
  const [year, month] = dateStr.split("-").map(Number);
  const start = istWallTimeToInstant(`${year}-${String(month).padStart(2, "0")}-01`, "00:00");
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = istWallTimeToInstant(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01`, "00:00");
  return { start, end };
}

/** Start-of-day instant (IST midnight) for the IST calendar date `dateStr`. Alias for `istDayBounds(dateStr).start`. */
export function startOfDayIST(dateStr: string): Date {
  return istWallTimeToInstant(dateStr, "00:00");
}

/** End-of-day instant, EXCLUSIVE (the start of the next IST calendar day). Alias for `istDayBounds(dateStr).end`. */
export function endOfDayIST(dateStr: string): Date {
  return istDayBounds(dateStr).end;
}

/** Start-of-month instant (IST midnight on the 1st) for `year`-`month` (1-12). */
export function startOfMonthIST(year: number, month: number): Date {
  return istWallTimeToInstant(`${year}-${String(month).padStart(2, "0")}-01`, "00:00");
}

/** End-of-month instant, EXCLUSIVE (the start of the following IST calendar month). */
export function endOfMonthIST(year: number, month: number): Date {
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return startOfMonthIST(nextYear, nextMonth);
}

/** Number of calendar days in the IST calendar month `year`-`month` (1-12). */
export function daysInMonthIST(year: number, month: number): number {
  const ms = endOfMonthIST(year, month).getTime() - startOfMonthIST(year, month).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/** [start, end) instants spanning the IST calendar year containing `dateStr`. */
export function istYearBounds(dateStr: string): { start: Date; end: Date } {
  const year = Number(dateStr.slice(0, 4));
  return {
    start: istWallTimeToInstant(`${year}-01-01`, "00:00"),
    end: istWallTimeToInstant(`${year + 1}-01-01`, "00:00"),
  };
}

/** JS-standard weekday number (0 = Sunday .. 6 = Saturday) for an instant, evaluated in IST. Drop-in replacement for `date.getDay()`. */
export function getISTWeekday(date: Date): number {
  return SUN_FIRST_WEEKDAY_INDEX[toISTWeekday(date)];
}

/** Day-of-month (1-31) for an instant, evaluated in IST. Drop-in replacement for `date.getDate()`. */
export function getISTDayOfMonth(date: Date): number {
  return Number(toISTDateString(date).slice(8, 10));
}

/** Calendar year for an instant, evaluated in IST. Drop-in replacement for `date.getFullYear()`. */
export function getISTYear(date: Date): number {
  return Number(toISTDateString(date).slice(0, 4));
}

/** Calendar month (1-12) for an instant, evaluated in IST. Drop-in replacement for `date.getMonth() + 1`. */
export function getISTMonth(date: Date): number {
  return Number(toISTDateString(date).slice(5, 7));
}

/** {year, month} for "now", evaluated in IST. Replaces `now.getFullYear()` / `now.getMonth() + 1` defaults. */
export function currentISTMonthYear(): { year: number; month: number } {
  const [year, month] = todayISTDateString().split("-").map(Number);
  return { year, month };
}

/** Decomposed Asia/Kolkata wall-clock parts for an instant (used internally for calendar-safe month/year arithmetic). */
function istWallClockParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const [year, month, day] = toISTDateString(date).split("-").map(Number);
  const [hour, minute, second] = IST_HHMMSS_FORMATTER.format(date).split(":").map(Number);
  return { year, month, day, hour, minute, second };
}

/**
 * Adds whole calendar months to an instant, evaluated in the IST calendar
 * (not the host process timezone), clamping the day-of-month to the target
 * month's length (e.g. 31 Jan + 1 month -> 28/29 Feb) and preserving the
 * IST wall-clock time-of-day. Use for subscription/trial period math instead
 * of `Date.prototype.setMonth`, which reads/writes calendar fields in the
 * host process timezone and can disagree with the IST calendar near
 * midnight when the server runs in UTC.
 */
export function addISTCalendarMonths(date: Date, months: number): Date {
  const { year, month, day, hour, minute, second } = istWallClockParts(date);
  const totalMonthIndex = (month - 1) + months;
  const targetYear = year + Math.floor(totalMonthIndex / 12);
  const targetMonth = (((totalMonthIndex % 12) + 12) % 12) + 1;
  const clampedDay = Math.min(day, daysInMonthIST(targetYear, targetMonth));
  const dateStr = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return new Date(istWallTimeToInstant(dateStr, time).getTime() + second * 1000);
}

/** Adds whole calendar years to an instant, evaluated in the IST calendar. See `addISTCalendarMonths`. */
export function addISTCalendarYears(date: Date, years: number): Date {
  return addISTCalendarMonths(date, years * 12);
}

/** Counts days in [start, end) whose IST weekday is included in `workingDays` (e.g. `Tenant.workingDays`). */
export function countISTWorkingDaysInRange(start: Date, end: Date, workingDays: string[]): number {
  let count = 0;
  let cursorStr = toISTDateString(start);
  const endStr = toISTDateString(end);

  while (cursorStr < endStr) {
    if (workingDays.includes(toISTWeekday(istWallTimeToInstant(cursorStr, "00:00")))) {
      count += 1;
    }
    const next = new Date(istWallTimeToInstant(cursorStr, "00:00").getTime() + 24 * 60 * 60 * 1000);
    cursorStr = toISTDateString(next);
  }

  return count;
}

/** "DD/MM/YYYY, h:mm AM/PM" in IST, for an absolute instant. */
export function formatISTDateTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return IST_DATETIME_FORMATTER.format(date).replace(",", "");
}

/** "15 September" style label in IST, for an absolute instant. */
export function formatISTDayMonth(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return IST_DAY_MONTH_FORMATTER.format(date);
}

/** Add whole minutes to a "HH:mm" wall-clock time, wrapping within a 24h day (for same-day offset labels). */
export function addMinutesToClock(time: string, minutes: number): string {
  const [hours, mins] = time.split(":").map(Number);
  const total = (((hours * 60 + mins + minutes) % 1440) + 1440) % 1440;
  const hh = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const mm = (total % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Absolute instant for an appointment date + "HH:mm" time + a minute offset (may cross midnight). */
export function instantForOffset(appointmentDate: Date, appointmentTime: string, offsetMinutes: number): Date {
  const dateStr = toISTDateString(appointmentDate);
  const base = istWallTimeToInstant(dateStr, "00:00");
  const [hours, mins] = appointmentTime.split(":").map(Number);
  const totalMinutes = hours * 60 + mins + offsetMinutes;
  return new Date(base.getTime() + totalMinutes * 60 * 1000);
}

/** "DD/MM/YYYY" in IST. */
export function formatISTDateDDMMYYYY(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return IST_DDMMYYYY_FORMATTER.format(date);
}

/** "h:mm AM/PM" in IST, for an absolute instant (e.g. createdAt). */
export function formatISTInstantTime12Hour(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return IST_TIME_12H_FORMATTER.format(date);
}

/**
 * "h:mm AM/PM" for a plain "HH:mm" wall-clock string (already IST, no
 * timezone conversion needed — it's not an instant).
 */
export function formatClockTime12Hour(time: string): string {
  const [hoursPart, minutesPart] = time.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart ?? "0");
  const period = hours >= 12 ? "PM" : "AM";
  const twelveHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelveHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

/** "1 hr 30 min" style duration label. */
export function formatDurationLabel(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
}
