/**
 * Resolves the salon's effective open/close hours for one IST calendar date,
 * combining the per-weekday `SalonSettings` configuration (falling back to
 * `Tenant.workingDays`/`openTime`/`closeTime` when no settings row exists yet)
 * with a same-day `Holiday` check. Used by the Day View calendar to decide
 * what to render and whether the day is closed.
 */
import { prisma } from "@/lib/prisma";
import { toISTWeekday, istWallTimeToInstant } from "@/lib/time";

const DAY_FIELD_MAP = {
  Mon: "monday",
  Tue: "tuesday",
  Wed: "wednesday",
  Thu: "thursday",
  Fri: "friday",
  Sat: "saturday",
  Sun: "sunday",
} as const;

export type SalonSettingsRow = {
  mondayEnabled: boolean;
  mondayOpen: string;
  mondayClose: string;
  tuesdayEnabled: boolean;
  tuesdayOpen: string;
  tuesdayClose: string;
  wednesdayEnabled: boolean;
  wednesdayOpen: string;
  wednesdayClose: string;
  thursdayEnabled: boolean;
  thursdayOpen: string;
  thursdayClose: string;
  fridayEnabled: boolean;
  fridayOpen: string;
  fridayClose: string;
  saturdayEnabled: boolean;
  saturdayOpen: string;
  saturdayClose: string;
  sundayEnabled: boolean;
  sundayOpen: string;
  sundayClose: string;
} | null;

const SALON_SETTINGS_WEEKDAY_SELECT = {
  mondayEnabled: true,
  mondayOpen: true,
  mondayClose: true,
  tuesdayEnabled: true,
  tuesdayOpen: true,
  tuesdayClose: true,
  wednesdayEnabled: true,
  wednesdayOpen: true,
  wednesdayClose: true,
  thursdayEnabled: true,
  thursdayOpen: true,
  thursdayClose: true,
  fridayEnabled: true,
  fridayOpen: true,
  fridayClose: true,
  saturdayEnabled: true,
  saturdayOpen: true,
  saturdayClose: true,
  sundayEnabled: true,
  sundayOpen: true,
  sundayClose: true,
} as const;

export type DayBusinessHours = {
  open: string;
  close: string;
  closed: boolean;
  closedReason: string | null;
};

/**
 * `Holiday.date` is stored as a literal UTC-midnight instant for the holiday's
 * calendar date string (see `/api/settings/business-hours`), so it must be
 * looked up the same way rather than via the IST day-bounds helpers used for
 * appointment instants.
 */
function holidayDateKey(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export function resolveDayBusinessHours({
  dateStr,
  settings,
  tenant,
}: {
  dateStr: string;
  settings: SalonSettingsRow;
  tenant: { openTime: string; closeTime: string; workingDays: string[] };
}): { open: string; close: string; enabled: boolean } {
  const weekday = toISTWeekday(istWallTimeToInstant(dateStr, "00:00"));
  const field = DAY_FIELD_MAP[weekday];

  if (settings) {
    return {
      enabled: Boolean(settings[`${field}Enabled` as keyof SalonSettingsRow]),
      open: String(settings[`${field}Open` as keyof SalonSettingsRow]),
      close: String(settings[`${field}Close` as keyof SalonSettingsRow]),
    };
  }

  return {
    enabled: tenant.workingDays.includes(weekday),
    open: tenant.openTime,
    close: tenant.closeTime,
  };
}

export async function getBusinessHoursForDate({
  tenantId,
  dateStr,
}: {
  tenantId: string;
  dateStr: string;
}): Promise<DayBusinessHours> {
  // Sequential queries (no Promise.all) to avoid the connection-pool race
  // noted elsewhere in this codebase when a single request fires several
  // concurrent Prisma queries.
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { openTime: true, closeTime: true, workingDays: true },
  });

  if (!tenant) {
    return { open: "09:00", close: "21:00", closed: true, closedReason: "Salon not found." };
  }

  const settings = await prisma.salonSettings.findUnique({
    where: { tenantId },
    select: SALON_SETTINGS_WEEKDAY_SELECT,
  });

  const holiday = await prisma.holiday.findUnique({
    where: { tenantId_date: { tenantId, date: holidayDateKey(dateStr) } },
    select: { name: true },
  });

  const day = resolveDayBusinessHours({ dateStr, settings, tenant });

  if (holiday) {
    return { open: day.open, close: day.close, closed: true, closedReason: `Holiday: ${holiday.name}` };
  }

  if (!day.enabled) {
    return { open: day.open, close: day.close, closed: true, closedReason: "Closed on this day" };
  }

  return { open: day.open, close: day.close, closed: false, closedReason: null };
}

export type MonthBusinessHoursContext = {
  tenant: { openTime: string; closeTime: string; workingDays: string[] };
  settings: SalonSettingsRow;
  /** "YYYY-MM-DD" IST dates within the month that fall on a `Holiday`. */
  holidayDates: Set<string>;
};

/**
 * Loads tenant + settings + this month's holidays once, so callers that need
 * "is this date automatically non-working" for every day in an IST calendar
 * month (payroll attendance checks, the daily-rate WORKING_DAYS divisor) can
 * answer it per-date with pure JS instead of one DB round-trip per date.
 */
export async function loadMonthBusinessHoursContext({
  tenantId,
  year,
  month,
}: {
  tenantId: string;
  year: number;
  month: number;
}): Promise<MonthBusinessHoursContext | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { openTime: true, closeTime: true, workingDays: true },
  });

  if (!tenant) {
    return null;
  }

  const settings = await prisma.salonSettings.findUnique({
    where: { tenantId },
    select: SALON_SETTINGS_WEEKDAY_SELECT,
  });

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const monthStartKey = holidayDateKey(`${year}-${String(month).padStart(2, "0")}-01`);
  const monthEndKey = holidayDateKey(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01`);

  const holidays = await prisma.holiday.findMany({
    where: { tenantId, date: { gte: monthStartKey, lt: monthEndKey } },
    select: { date: true },
  });

  const holidayDates = new Set(holidays.map((holiday) => holiday.date.toISOString().slice(0, 10)));

  return { tenant, settings, holidayDates };
}

/**
 * Whether IST calendar date `dateStr` is an automatic non-working day
 * (business-hours weekday disabled, or a `Holiday`), using a pre-loaded
 * `MonthBusinessHoursContext`. Pure/cheap — no DB call. Matches the "closed"
 * rule used by `getBusinessHoursForDate` (same holiday + weekday logic), so
 * a date flagged here also displays as automatic Week Off in the attendance
 * UI (see `resolveAttendanceDisplayStatus` in `src/lib/attendanceStatus.ts`).
 */
export function isAutomaticNonWorkingDay(dateStr: string, context: MonthBusinessHoursContext): boolean {
  if (context.holidayDates.has(dateStr)) {
    return true;
  }

  return !resolveDayBusinessHours({ dateStr, settings: context.settings, tenant: context.tenant }).enabled;
}

