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

type SalonSettingsRow = {
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
    select: {
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
    },
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
