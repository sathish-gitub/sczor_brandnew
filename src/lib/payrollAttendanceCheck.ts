/**
 * Shared "is attendance complete for payroll?" rule.
 *
 * For a payroll month and an active staff member, the required IST days run
 * from the 1st of the month (or the staff member's `joiningDate` if it falls
 * later in that month) up to the payroll end date: the last day of the
 * month for a past month, or today (IST, inclusive) for the current month.
 * Future months have no required days.
 *
 * A required day that is Week Off (an automatic non-working day — business
 * hours weekday disabled, or a `Holiday` — or a stored `WEEK_OFF`
 * Attendance row) is skipped. Any other required day with no `Attendance`
 * row at all (regardless of status) is "missing".
 *
 * Used by the payroll preview/generate endpoints, the staff overview
 * "Attendance incomplete" badge, and the payroll page's confirmation
 * popups, so they all agree on exactly the same missing dates.
 */
import { prisma } from "@/lib/prisma";
import { isAutomaticNonWorkingDay, loadMonthBusinessHoursContext, type MonthBusinessHoursContext } from "@/lib/businessHours";
import {
  currentISTMonthYear,
  daysInMonthIST,
  getISTDayOfMonth,
  getISTMonth,
  getISTYear,
  istMonthBounds,
  todayISTDateString,
  toISTDateString,
} from "@/lib/time";

export type StaffAttendanceRequirement = {
  staffId: string;
  staffName: string;
  joiningDate: Date | null;
};

export type MissingAttendanceByStaff = {
  staffId: string;
  staffName: string;
  /** "YYYY-MM-DD" IST dates, ascending. Empty means attendance is complete. */
  missingDates: string[];
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Per-staff list of IST calendar dates with incomplete attendance for one
 * payroll month. Only pass ACTIVE staff members; a staff member whose
 * `joiningDate` falls entirely after this payroll month gets no required
 * days (empty `missingDates`).
 */
export async function getMissingAttendanceByStaff({
  tenantId,
  month,
  year,
  staff,
  context: preloadedContext,
}: {
  tenantId: string;
  month: number;
  year: number;
  staff: StaffAttendanceRequirement[];
  /** Pass a context already loaded via `loadMonthBusinessHoursContext` to avoid re-fetching it (e.g. when the caller also needs it for the WORKING_DAYS daily-rate divisor). */
  context?: MonthBusinessHoursContext | null;
}): Promise<MissingAttendanceByStaff[]> {
  if (staff.length === 0) {
    return [];
  }

  const { year: currentYear, month: currentMonth } = currentISTMonthYear();
  const isFutureMonth = year > currentYear || (year === currentYear && month > currentMonth);

  if (isFutureMonth) {
    return staff.map((member) => ({ staffId: member.staffId, staffName: member.staffName, missingDates: [] }));
  }

  const isCurrentMonth = year === currentYear && month === currentMonth;
  const daysInMonth = daysInMonthIST(year, month);
  const lastRequiredDay = isCurrentMonth ? Number(todayISTDateString().slice(8, 10)) : daysInMonth;

  const context = preloadedContext !== undefined ? preloadedContext : await loadMonthBusinessHoursContext({ tenantId, year, month });

  const { start, end } = istMonthBounds(`${year}-${pad(month)}-01`);
  const attendanceRows = await prisma.attendance.findMany({
    where: { tenantId, staffId: { in: staff.map((member) => member.staffId) }, date: { gte: start, lt: end } },
    select: { staffId: true, date: true },
  });

  const attendedDatesByStaff = new Map<string, Set<string>>();
  for (const row of attendanceRows) {
    const set = attendedDatesByStaff.get(row.staffId) ?? new Set<string>();
    set.add(toISTDateString(row.date));
    attendedDatesByStaff.set(row.staffId, set);
  }

  return staff.map((member) => {
    let startDay = 1;

    if (member.joiningDate) {
      const joinYear = getISTYear(member.joiningDate);
      const joinMonth = getISTMonth(member.joiningDate);

      if (joinYear > year || (joinYear === year && joinMonth > month)) {
        return { staffId: member.staffId, staffName: member.staffName, missingDates: [] };
      }

      if (joinYear === year && joinMonth === month) {
        startDay = getISTDayOfMonth(member.joiningDate);
      }
    }

    const attendedDates = attendedDatesByStaff.get(member.staffId) ?? new Set<string>();
    const missingDates: string[] = [];

    for (let day = startDay; day <= lastRequiredDay; day += 1) {
      const dateStr = `${year}-${pad(month)}-${pad(day)}`;

      if (attendedDates.has(dateStr)) {
        continue;
      }

      if (context && isAutomaticNonWorkingDay(dateStr, context)) {
        continue;
      }

      missingDates.push(dateStr);
    }

    return { staffId: member.staffId, staffName: member.staffName, missingDates };
  });
}

/** Convenience wrapper for a single staff member (payroll preview/generate for one person). */
export async function getMissingAttendanceForStaff({
  tenantId,
  staffId,
  staffName,
  joiningDate,
  month,
  year,
  context,
}: {
  tenantId: string;
  staffId: string;
  staffName: string;
  joiningDate: Date | null;
  month: number;
  year: number;
  context?: MonthBusinessHoursContext | null;
}): Promise<string[]> {
  const [result] = await getMissingAttendanceByStaff({
    tenantId,
    month,
    year,
    staff: [{ staffId, staffName, joiningDate }],
    context,
  });

  return result?.missingDates ?? [];
}

/**
 * Count of "Week Off" IST dates across the whole calendar month (automatic
 * non-working days, unioned with `storedWeekOffDates`), for the
 * WORKING_DAYS daily-rate divisor (see `src/lib/payrollDayMethod.ts`).
 * Unlike `getMissingAttendanceByStaff`, this always covers the full month —
 * the daily-rate divisor is a per-month constant, not scoped to days worked.
 */
export function countWeekOffDatesInMonth({
  year,
  month,
  context,
  storedWeekOffDates,
}: {
  year: number;
  month: number;
  context: MonthBusinessHoursContext | null;
  storedWeekOffDates: Iterable<string>;
}): number {
  const daysInMonth = daysInMonthIST(year, month);
  const weekOffDates = new Set(storedWeekOffDates);

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateStr = `${year}-${pad(month)}-${pad(day)}`;

    if (context && isAutomaticNonWorkingDay(dateStr, context)) {
      weekOffDates.add(dateStr);
    }
  }

  return weekOffDates.size;
}

export { formatMissingDatesSummary } from "@/lib/formatMissingDates";

