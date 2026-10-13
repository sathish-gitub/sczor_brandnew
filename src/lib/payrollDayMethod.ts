/**
 * Daily-rate divisor method for payroll Absent/Half Day/LOP deductions.
 * Configured per salon via Settings > Payroll (`SalonSettings.payrollDayMethod`),
 * default `CALENDAR_DAYS`. Only the divisor changes between methods — the
 * deduction formula itself (`(absentDays + lopDays + halfDays * 0.5) *
 * dailyRate`) is unchanged, see `src/lib/payrollCalculation.ts`.
 */

export const PAYROLL_DAY_METHOD_VALUES = ["CALENDAR_DAYS", "FIXED_30", "WORKING_DAYS"] as const;

export type PayrollDayMethod = (typeof PAYROLL_DAY_METHOD_VALUES)[number];

export const DEFAULT_PAYROLL_DAY_METHOD: PayrollDayMethod = "CALENDAR_DAYS";

export const PAYROLL_DAY_METHOD_INFO: Record<PayrollDayMethod, { label: string; description: string; example: string }> = {
  CALENDAR_DAYS: {
    label: "Calendar Days",
    description: "Divide the monthly salary by the actual number of days in that month (28-31).",
    example: "Salary 30,000 in a 30-day month = 1,000 per day; in a 31-day month = 967.74 per day.",
  },
  FIXED_30: {
    label: "Fixed 30 Days",
    description: "Always divide the monthly salary by 30, regardless of how many days are in the month.",
    example: "Salary 30,000 = 1,000 per day, every month.",
  },
  WORKING_DAYS: {
    label: "Working Days",
    description:
      "Divide the monthly salary by the days in the month minus Week Off days (automatic non-working days plus that staff member's stored Week Offs), never less than 1.",
    example: "Salary 30,000 in a 30-day month with 4 Week Off days = 30,000 / 26 = 1,153.85 per day.",
  },
};

/** Daily-rate divisor for `method`, given the month's actual day count and its Week Off day count. Never less than 1. */
export function computeDailyRateDivisor({
  method,
  daysInMonth,
  weekOffDaysInMonth,
}: {
  method: PayrollDayMethod;
  daysInMonth: number;
  weekOffDaysInMonth: number;
}): number {
  if (method === "FIXED_30") {
    return 30;
  }

  if (method === "WORKING_DAYS") {
    return Math.max(1, daysInMonth - weekOffDaysInMonth);
  }

  return daysInMonth;
}
