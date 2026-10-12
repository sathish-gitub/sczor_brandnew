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

const IST_TIME_12H_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: IST_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

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
