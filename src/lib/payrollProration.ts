/**
 * Pure (no database access) payroll proration formula, kept separate from
 * `src/lib/payrollCalculation.ts` so it can be unit tested directly — see
 * `src/lib/payrollProration.test.ts`.
 *
 * All dates in this module are plain IST calendar-date strings ("YYYY-MM-DD"),
 * already resolved by the caller via `src/lib/time.ts`. The arithmetic here is
 * pure string/number math and does not depend on the host process timezone.
 *
 * FORMULA (see task spec)
 * - periodStart = later of the 1st of the month and Staff.joiningDate.
 * - periodEnd = earliest of (month end for a past month, or today IST for the
 *   current month) and Staff.lastWorkingDate if set.
 * - No payable days (future month, or start after end) blocks generation.
 * - divisor: CALENDAR_DAYS = days in month; FIXED_30 = 30; WORKING_DAYS = days
 *   in month minus that staff member's Week Off days (whole month).
 * - dailyRate = baseSalary / divisor, kept at full precision.
 * - payableDays: CALENDAR_DAYS/FIXED_30 = calendar days periodStart..periodEnd
 *   inclusive, capped at the divisor. WORKING_DAYS = those days minus Week Off
 *   days inside the period.
 * - baseSalaryPaid = round2(dailyRate * payableDays).
 * - deductionDays = unpaid ABSENT + LOP + 0.5 * HALF_DAY, counting only
 *   attendance rows dated inside the period. Week Off is never deducted.
 *   paidLeavesPerMonth is NOT prorated.
 * - deduction = round2(dailyRate * deductionDays).
 * - netPay = baseSalaryPaid + commission - deduction, using rounded parts.
 */
import { addDaysToDateString, daysInMonthIST } from "@/lib/time";

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** First IST calendar day ("YYYY-MM-DD") of `year`-`month` (1-12). */
export function monthStartDateString(year: number, month: number): string {
  return `${year}-${pad(month)}-01`;
}

/** Last IST calendar day ("YYYY-MM-DD") of `year`-`month` (1-12). */
export function monthEndDateString(year: number, month: number): string {
  return `${year}-${pad(month)}-${pad(daysInMonthIST(year, month))}`;
}

/** Inclusive count of calendar days between two "YYYY-MM-DD" strings (pure date-string math). */
export function countInclusiveDays(startDateStr: string, endDateStr: string): number {
  const [sy, sm, sd] = startDateStr.split("-").map(Number);
  const [ey, em, ed] = endDateStr.split("-").map(Number);
  const startMs = Date.UTC(sy, sm - 1, sd);
  const endMs = Date.UTC(ey, em - 1, ed);
  return Math.round((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1;
}

export type PayrollPeriod = {
  periodStart: string;
  periodEnd: string;
};

/**
 * Resolves the payable period for one staff member/month, or `null` when
 * there are no payable days (future month, staff joined after the month
 * ended, or left before the month started / before the 1st).
 */
export function resolvePayrollPeriod({
  year,
  month,
  joiningDateStr,
  lastWorkingDateStr,
  todayDateStr,
}: {
  year: number;
  month: number;
  /** IST "YYYY-MM-DD", or null if unknown. */
  joiningDateStr: string | null;
  /** IST "YYYY-MM-DD", or null if the staff member has no recorded last working date. */
  lastWorkingDateStr: string | null;
  /** `todayISTDateString()` from the caller, injectable for tests. */
  todayDateStr: string;
}): PayrollPeriod | null {
  const monthStart = monthStartDateString(year, month);
  const monthEnd = monthEndDateString(year, month);

  const [todayYear, todayMonth] = todayDateStr.split("-").map(Number);
  const isFutureMonth = year > todayYear || (year === todayYear && month > todayMonth);
  if (isFutureMonth) {
    return null;
  }

  const isCurrentMonth = year === todayYear && month === todayMonth;
  const periodEndCandidate = isCurrentMonth && todayDateStr < monthEnd ? todayDateStr : monthEnd;

  const periodStart = joiningDateStr && joiningDateStr > monthStart ? joiningDateStr : monthStart;
  const periodEnd = lastWorkingDateStr && lastWorkingDateStr < periodEndCandidate ? lastWorkingDateStr : periodEndCandidate;

  if (periodStart > periodEnd) {
    return null;
  }

  return { periodStart, periodEnd };
}

export type AttendanceStatusCount = "PRESENT" | "ABSENT" | "LEAVE" | "HALF_DAY" | "WEEK_OFF";

/**
 * Tallies attendance rows by status, counting ONLY rows dated within the
 * inclusive [periodStart, periodEnd] range — a row dated outside the period
 * (e.g. after a staff member's lastWorkingDate, or before their joiningDate)
 * is ignored entirely, per the proration spec.
 */
export function countAttendanceInPeriod(
  rows: { status: AttendanceStatusCount; dateStr: string }[],
  periodStart: string,
  periodEnd: string,
): Record<AttendanceStatusCount, number> {
  const counts: Record<AttendanceStatusCount, number> = { PRESENT: 0, ABSENT: 0, LEAVE: 0, HALF_DAY: 0, WEEK_OFF: 0 };

  for (const row of rows) {
    if (row.dateStr < periodStart || row.dateStr > periodEnd) {
      continue;
    }

    counts[row.status] += 1;
  }

  return counts;
}

/** Splits a period's LEAVE count into paid (within allowance) and LOP (excess), per the non-prorated monthly allowance. */
export function splitLeaveDays(leaveDaysInPeriod: number, paidLeavesPerMonth: number): { paidLeaveDays: number; lopDays: number } {
  return {
    paidLeaveDays: Math.min(leaveDaysInPeriod, paidLeavesPerMonth),
    lopDays: Math.max(0, leaveDaysInPeriod - paidLeavesPerMonth),
  };
}

export type ProrationInput = {
  dayMethod: "CALENDAR_DAYS" | "FIXED_30" | "WORKING_DAYS";
  divisor: number;
  periodStart: string;
  periodEnd: string;
  /** Count of Week Off IST dates (automatic + stored) that fall within [periodStart, periodEnd]. Only used for WORKING_DAYS. */
  weekOffDaysInPeriod: number;
  baseSalary: number;
  /** Unpaid ABSENT days, counting only attendance rows dated within the period. */
  absentDays: number;
  /** Excess LEAVE days beyond the (non-prorated) monthly allowance, counting only attendance rows dated within the period. */
  lopDays: number;
  /** HALF_DAY days, counting only attendance rows dated within the period. */
  halfDays: number;
  /** Revenue attributed to this staff member for invoices dated within the period. */
  revenueInPeriod: number;
  commissionRate: number;
};

export type ProrationResult = {
  payableDays: number;
  dailyRate: number;
  baseSalaryPaid: number;
  deductionDays: number;
  deduction: number;
  commission: number;
  grossPay: number;
  netPay: number;
};

/** The pure proration formula — no database access, fully unit-testable. */
export function computeProratedPayroll(input: ProrationInput): ProrationResult {
  const { dayMethod, divisor, periodStart, periodEnd, weekOffDaysInPeriod, baseSalary, absentDays, lopDays, halfDays, revenueInPeriod, commissionRate } = input;

  const calendarDays = countInclusiveDays(periodStart, periodEnd);
  const cappedCalendarDays = Math.min(calendarDays, divisor);
  // If the divisor caps the period short of its natural end (e.g. FIXED_30 in a
  // 31-day month), only count Week Off days inside that shorter effective window.
  const effectivePeriodEnd = calendarDays <= divisor ? periodEnd : addDaysToDateString(periodStart, divisor - 1);
  const weekOffDaysInEffectivePeriod = effectivePeriodEnd === periodEnd ? weekOffDaysInPeriod : Math.min(weekOffDaysInPeriod, cappedCalendarDays);

  const payableDays = dayMethod === "WORKING_DAYS" ? Math.max(0, cappedCalendarDays - weekOffDaysInEffectivePeriod) : cappedCalendarDays;

  const dailyRate = baseSalary / divisor;
  const baseSalaryPaid = roundMoney(dailyRate * payableDays);

  const deductionDays = absentDays + lopDays + halfDays * 0.5;
  const deduction = roundMoney(dailyRate * deductionDays);

  const commission = roundMoney(revenueInPeriod * (commissionRate / 100));

  const grossPay = roundMoney(baseSalaryPaid + commission);
  const netPay = roundMoney(grossPay - deduction);

  return { payableDays, dailyRate, baseSalaryPaid, deductionDays, deduction, commission, grossPay, netPay };
}
