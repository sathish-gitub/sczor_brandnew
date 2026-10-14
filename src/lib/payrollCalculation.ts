import { prisma } from "@/lib/prisma";
import { getStaffRevenue } from "@/lib/staffRevenue";
import { istMonthBounds, istRangeBounds, daysInMonthIST, toISTDateString, todayISTDateString, currentISTMonthYear } from "@/lib/time";
import { getStaffDesignationName, staffDesignationSelect } from "@/lib/staffDesignation";
import { loadMonthBusinessHoursContext } from "@/lib/businessHours";
import {
  countWeekOffDatesInMonth,
  countWeekOffDatesInRange,
  getMissingAttendanceForStaff,
  formatMissingDatesSummary,
} from "@/lib/payrollAttendanceCheck";
import { computeDailyRateDivisor, DEFAULT_PAYROLL_DAY_METHOD, type PayrollDayMethod } from "@/lib/payrollDayMethod";
import { computeProratedPayroll, countAttendanceInPeriod, resolvePayrollPeriod, roundMoney, splitLeaveDays } from "@/lib/payrollProration";

export class PayrollCalculationError extends Error {
  /** Populated only when the failure is incomplete attendance, so callers can render the missing dates directly. */
  missingDates?: string[];

  constructor(message: string, missingDates?: string[]) {
    super(message);
    this.missingDates = missingDates;
  }
}

export type PayrollCalculationResult = {
  staffId: string;
  staffName: string;
  designation: string;
  /** Full configured monthly salary (not prorated). */
  baseSalary: number;
  commissionRate: number;
  commissionAmount: number;
  /** Revenue attributed to invoices dated within the payable period only. */
  revenueGenerated: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  halfDays: number;
  weekOffDays: number;
  paidLeaveDays: number;
  lopDays: number;
  usedDefaultLeaveAllowance: boolean;
  totalWorkingDays: number;
  dayMethod: PayrollDayMethod;
  dailyRateDivisor: number;
  /** Full-precision baseSalary / dailyRateDivisor, rounded only for display. */
  dailyRate: number;
  /** Payable period, capped by joiningDate, lastWorkingDate, month bounds, and "today" for the current month. */
  periodStart: string;
  periodEnd: string;
  /** Calendar/working days actually paid within the period (capped at dailyRateDivisor). */
  payableDays: number;
  /** baseSalary prorated to payableDays, i.e. the base-pay component actually paid this payslip. */
  baseSalaryPaid: number;
  /** Unpaid ABSENT + LOP + 0.5 x HALF_DAY days within the period. */
  deductionDays: number;
  leaveDeduction: number;
  /** baseSalaryPaid + commissionAmount. */
  grossPay: number;
  netPay: number;
};

/** [start, end) instants spanning the IST calendar month `year-month`. */
function monthBounds(year: number, month: number) {
  return istMonthBounds(`${year}-${String(month).padStart(2, "0")}-01`);
}

export async function calculatePayroll(
  staffId: string,
  month: number,
  year: number,
  tenantId: string,
): Promise<PayrollCalculationResult> {
  const [staff, salonSettings] = await Promise.all([
    prisma.staff.findFirst({
      where: { id: staffId, tenantId },
      select: {
        name: true,
        ...staffDesignationSelect,
        baseSalary: true,
        commissionRate: true,
        paidLeavesPerMonth: true,
        joiningDate: true,
        lastWorkingDate: true,
        salaryHistory: {
          orderBy: { effectiveFrom: "desc" },
          select: {
            baseSalary: true,
            commissionRate: true,
            paidLeavesPerMonth: true,
            effectiveFrom: true,
            effectiveTo: true,
          },
        },
      },
    }),
    prisma.salonSettings.findUnique({
      where: { tenantId },
      select: { defaultPaidLeavesPerMonth: true, payrollDayMethod: true },
    }),
  ]);

  if (!staff) {
    throw new PayrollCalculationError("Staff not found.");
  }

  const tenantDefaultPaidLeaves = salonSettings?.defaultPaidLeavesPerMonth ?? 1;
  const dayMethod: PayrollDayMethod = salonSettings?.payrollDayMethod ?? DEFAULT_PAYROLL_DAY_METHOD;

  const { start, end } = monthBounds(year, month);

  // Salary as-of that month, not necessarily the staff's current configured salary.
  const applicableHistory = staff.salaryHistory
    .filter((entry) => entry.effectiveFrom < end && (entry.effectiveTo === null || entry.effectiveTo >= start))
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0];

  const baseSalary = applicableHistory
    ? Number(applicableHistory.baseSalary)
    : staff.baseSalary === null
      ? null
      : Number(staff.baseSalary);

  const commissionRate = applicableHistory
    ? Number(applicableHistory.commissionRate)
    : staff.commissionRate === null
      ? null
      : Number(staff.commissionRate);

  // A staff-level or as-of-month history override takes precedence; null means "use the salon's default".
  const configuredPaidLeavesPerMonth = applicableHistory ? applicableHistory.paidLeavesPerMonth : staff.paidLeavesPerMonth;
  const usedDefaultLeaveAllowance = configuredPaidLeavesPerMonth === null;
  const paidLeavesPerMonth = configuredPaidLeavesPerMonth ?? tenantDefaultPaidLeaves;

  if (baseSalary === null || commissionRate === null) {
    throw new PayrollCalculationError("Salary is not configured for this staff member.");
  }

  // Payable period: later of month-start/joiningDate through earlier of
  // month-end-or-today/lastWorkingDate. See src/lib/payrollProration.ts.
  const joiningDateStr = staff.joiningDate ? toISTDateString(staff.joiningDate) : null;
  const lastWorkingDateStr = staff.lastWorkingDate ? toISTDateString(staff.lastWorkingDate) : null;
  const todayDateStr = todayISTDateString();

  const period = resolvePayrollPeriod({ year, month, joiningDateStr, lastWorkingDateStr, todayDateStr });

  if (!period) {
    const { year: currentYear, month: currentMonth } = currentISTMonthYear();
    const isFutureMonth = year > currentYear || (year === currentYear && month > currentMonth);
    throw new PayrollCalculationError(
      isFutureMonth
        ? "Cannot generate payroll for a future month."
        : `There are no payable days for ${staff.name} in ${month}/${year}. Check their joining date and last working date.`,
    );
  }

  const { periodStart, periodEnd } = period;

  // Mandatory attendance check: every required IST day (1st of month, or
  // joiningDate if later, through the payroll end date, capped at
  // lastWorkingDate if set) must have an Attendance row unless it's Week
  // Off. See src/lib/payrollAttendanceCheck.ts.
  const businessHoursContext = await loadMonthBusinessHoursContext({ tenantId, year, month });
  const missingDates = await getMissingAttendanceForStaff({
    tenantId,
    staffId,
    staffName: staff.name,
    joiningDate: staff.joiningDate,
    lastWorkingDate: staff.lastWorkingDate,
    month,
    year,
    context: businessHoursContext,
  });

  if (missingDates.length > 0) {
    throw new PayrollCalculationError(
      `Attendance is incomplete for ${staff.name}. Missing dates: ${formatMissingDatesSummary(missingDates)}.`,
      missingDates,
    );
  }

  const attendance = await prisma.attendance.findMany({
    where: { tenantId, staffId, date: { gte: start, lt: end } },
    select: { status: true, date: true },
  });

  const storedWeekOffDates: string[] = [];
  const attendanceRows: { status: (typeof attendance)[number]["status"]; dateStr: string }[] = [];
  for (const entry of attendance) {
    const dateStr = toISTDateString(entry.date);
    attendanceRows.push({ status: entry.status, dateStr });
    if (entry.status === "WEEK_OFF") {
      storedWeekOffDates.push(dateStr);
    }
  }

  // Deduction/payable-day counts only consider attendance rows dated within
  // the payable period; anything outside it (e.g. after lastWorkingDate) is ignored.
  const counts = countAttendanceInPeriod(attendanceRows, periodStart, periodEnd);

  // Week Off (stored or automatic) is a fully paid day: included in the
  // working-days denominator, never deducted below.
  const totalWorkingDays = counts.PRESENT + counts.ABSENT + counts.LEAVE + counts.HALF_DAY + counts.WEEK_OFF;

  // Leave within the staff's monthly allowance stays fully paid (NOT prorated for a partial period);
  // excess leave becomes LOP, deducted like ABSENT.
  const { paidLeaveDays, lopDays } = splitLeaveDays(counts.LEAVE, paidLeavesPerMonth);

  // Daily rate denominator per the salon's configured payroll day method
  // (src/lib/payrollDayMethod.ts) -- a whole-month constant, independent of
  // the payable period or how many days were actually marked this month.
  const weekOffDaysInMonth = countWeekOffDatesInMonth({
    year,
    month,
    context: businessHoursContext,
    storedWeekOffDates,
  });
  const daysInMonth = daysInMonthIST(year, month);
  const dailyRateDivisor = computeDailyRateDivisor({ method: dayMethod, daysInMonth, weekOffDaysInMonth });

  // Week Off days inside the payable period only, for the WORKING_DAYS payableDays reduction.
  const weekOffDaysInPeriod = countWeekOffDatesInRange({
    startDateStr: periodStart,
    endDateStr: periodEnd,
    context: businessHoursContext,
    storedWeekOffDates,
  });

  // Reuses the same revenue attribution as the Staff Performance report
  // (src/app/api/reports/staff/route.ts): per invoice LINE (InvoiceItem.staffId),
  // falling back to Invoice.staffId for lines without per-line attribution —
  // but scoped to invoices dated within the payable period only.
  const periodBounds = istRangeBounds(periodStart, periodEnd);
  const { revenue: revenueGenerated } = await getStaffRevenue(tenantId, staffId, { gte: periodBounds.start, lt: periodBounds.end });

  const proration = computeProratedPayroll({
    dayMethod,
    divisor: dailyRateDivisor,
    periodStart,
    periodEnd,
    weekOffDaysInPeriod,
    baseSalary,
    absentDays: counts.ABSENT,
    lopDays,
    halfDays: counts.HALF_DAY,
    revenueInPeriod: revenueGenerated,
    commissionRate,
  });

  return {
    staffId,
    staffName: staff.name,
    designation: getStaffDesignationName(staff),
    baseSalary: roundMoney(baseSalary),
    commissionRate,
    commissionAmount: proration.commission,
    revenueGenerated,
    presentDays: counts.PRESENT,
    absentDays: counts.ABSENT,
    leaveDays: counts.LEAVE,
    halfDays: counts.HALF_DAY,
    weekOffDays: counts.WEEK_OFF,
    paidLeaveDays,
    lopDays,
    usedDefaultLeaveAllowance,
    totalWorkingDays,
    dayMethod,
    dailyRateDivisor,
    dailyRate: roundMoney(proration.dailyRate),
    periodStart,
    periodEnd,
    payableDays: proration.payableDays,
    baseSalaryPaid: proration.baseSalaryPaid,
    deductionDays: proration.deductionDays,
    leaveDeduction: proration.deduction,
    grossPay: proration.grossPay,
    netPay: proration.netPay,
  };
}

