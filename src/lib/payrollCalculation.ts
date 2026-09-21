import { prisma } from "@/lib/prisma";

export class PayrollCalculationError extends Error {}

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
  totalWorkingDays: number;
  leaveDeduction: number;
  grossPay: number;
  netPay: number;
};

function monthBounds(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(year, month, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
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
  const staff = await prisma.staff.findFirst({
    where: { id: staffId, tenantId },
    select: {
      name: true,
      designation: true,
      baseSalary: true,
      commissionRate: true,
      salaryHistory: {
        orderBy: { effectiveFrom: "desc" },
        select: { baseSalary: true, commissionRate: true, effectiveFrom: true, effectiveTo: true },
      },
    },
  });

  if (!staff) {
    throw new PayrollCalculationError("Staff not found.");
  }

  const { start, end } = monthBounds(year, month);

  // Salary as-of that month, not necessarily the staff's current configured salary.
  const applicableHistory = staff.salaryHistory
    .filter((entry) => entry.effectiveFrom <= end && (entry.effectiveTo === null || entry.effectiveTo >= start))
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

  if (baseSalary === null || commissionRate === null) {
    throw new PayrollCalculationError("Salary is not configured for this staff member.");
  }

  const attendance = await prisma.attendance.findMany({
    where: { tenantId, staffId, date: { gte: start, lte: end } },
    select: { status: true },
  });

  if (attendance.length === 0) {
    throw new PayrollCalculationError(
      "No attendance records found for this staff in the selected month - cannot generate payroll.",
    );
  }

  const counts = { PRESENT: 0, ABSENT: 0, LEAVE: 0, HALF_DAY: 0 };
  for (const entry of attendance) {
    counts[entry.status] += 1;
  }

  const totalWorkingDays = counts.PRESENT + counts.ABSENT + counts.LEAVE + counts.HALF_DAY;

  // LEAVE is paid leave (no deduction); only ABSENT and HALF_DAY reduce pay.
  const dailyRate = baseSalary / totalWorkingDays;
  const leaveDeduction = roundMoney((counts.ABSENT + counts.HALF_DAY * 0.5) * dailyRate);

  // Reuses the same revenue query as the Staff Performance report (src/app/api/reports/staff/route.ts).
  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      staffId,
      paymentStatus: "PAID",
      invoiceDate: { gte: start, lte: end },
    },
    select: { total: true },
  });

  const revenueGenerated = roundMoney(invoices.reduce((sum, invoice) => sum + Number(invoice.total), 0));
  const commissionAmount = roundMoney(revenueGenerated * (commissionRate / 100));

  const grossPay = roundMoney(baseSalary + commissionAmount);
  const netPay = roundMoney(grossPay - leaveDeduction);

  return {
    staffId,
    staffName: staff.name,
    designation: staff.designation,
    baseSalary: roundMoney(baseSalary),
    commissionRate,
    commissionAmount,
    revenueGenerated,
    presentDays: counts.PRESENT,
    absentDays: counts.ABSENT,
    leaveDays: counts.LEAVE,
    halfDays: counts.HALF_DAY,
    totalWorkingDays,
    leaveDeduction,
    grossPay,
    netPay,
  };
}
