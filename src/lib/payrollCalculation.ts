import { prisma } from "@/lib/prisma";
import { getStaffRevenue } from "@/lib/staffRevenue";
import { istMonthBounds, daysInMonthIST, toISTDateString } from "@/lib/time";
import { getStaffDesignationName, staffDesignationSelect } from "@/lib/staffDesignation";
import { loadMonthBusinessHoursContext } from "@/lib/businessHours";
import { countWeekOffDatesInMonth, getMissingAttendanceForStaff, formatMissingDatesSummary } from "@/lib/payrollAttendanceCheck";
import { computeDailyRateDivisor, DEFAULT_PAYROLL_DAY_METHOD, type PayrollDayMethod } from "@/lib/payrollDayMethod";

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
  baseSalary: number;
  commissionRate: number;
  commissionAmount: number;
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
  dailyRate: number;
  leaveDeduction: number;
  grossPay: number;
  netPay: number;
};

/** [start, end) instants spanning the IST calendar month `year-month`. */
function monthBounds(year: number, month: number) {
  return istMonthBounds(`${year}-${String(month).padStart(2, "0")}-01`);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
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

  // Mandatory attendance check: every required IST day (1st of month, or
  // joiningDate if later, through the payroll end date) must have an
  // Attendance row unless it's Week Off. See src/lib/payrollAttendanceCheck.ts.
  const businessHoursContext = await loadMonthBusinessHoursContext({ tenantId, year, month });
  const missingDates = await getMissingAttendanceForStaff({
    tenantId,
    staffId,
    staffName: staff.name,
    joiningDate: staff.joiningDate,
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

  const counts = { PRESENT: 0, ABSENT: 0, LEAVE: 0, HALF_DAY: 0, WEEK_OFF: 0 };
  const storedWeekOffDates: string[] = [];
  for (const entry of attendance) {
    counts[entry.status] += 1;
    if (entry.status === "WEEK_OFF") {
      storedWeekOffDates.push(toISTDateString(entry.date));
    }
  }

  // Week Off (stored or automatic) is a fully paid day: included in the
  // working-days denominator, never deducted below.
  const totalWorkingDays = counts.PRESENT + counts.ABSENT + counts.LEAVE + counts.HALF_DAY + counts.WEEK_OFF;

  // Leave within the staff's monthly allowance stays fully paid; excess leave becomes LOP, deducted like ABSENT.
  const paidLeaveDays = Math.min(counts.LEAVE, paidLeavesPerMonth);
  const lopDays = Math.max(0, counts.LEAVE - paidLeavesPerMonth);

  // Daily rate denominator per the salon's configured payroll day method
  // (src/lib/payrollDayMethod.ts) -- independent of how many days were
  // actually marked present/absent/leave this month.
  const weekOffDaysInMonth = countWeekOffDatesInMonth({
    year,
    month,
    context: businessHoursContext,
    storedWeekOffDates,
  });
  const daysInMonth = daysInMonthIST(year, month);
  const dailyRateDivisor = computeDailyRateDivisor({ method: dayMethod, daysInMonth, weekOffDaysInMonth });
  const dailyRate = baseSalary / dailyRateDivisor;
  const leaveDeduction = roundMoney((counts.ABSENT + lopDays + counts.HALF_DAY * 0.5) * dailyRate);

  // Reuses the same revenue attribution as the Staff Performance report
  // (src/app/api/reports/staff/route.ts): per invoice LINE (InvoiceItem.staffId),
  // falling back to Invoice.staffId for lines without per-line attribution.
  const { revenue: revenueGenerated } = await getStaffRevenue(tenantId, staffId, { gte: start, lt: end });
  const commissionAmount = roundMoney(revenueGenerated * (commissionRate / 100));

  const grossPay = roundMoney(baseSalary + commissionAmount);
  const netPay = roundMoney(grossPay - leaveDeduction);

  return {
    staffId,
    staffName: staff.name,
    designation: getStaffDesignationName(staff),
    baseSalary: roundMoney(baseSalary),
    commissionRate,
    commissionAmount,
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
    dailyRate: roundMoney(dailyRate),
    leaveDeduction,
    grossPay,
    netPay,
  };
}
