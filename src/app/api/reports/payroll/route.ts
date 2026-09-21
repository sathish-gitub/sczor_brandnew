import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const monthLabels = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const url = new URL(request.url);
  const now = new Date();
  const month = Number(url.searchParams.get("month") ?? now.getMonth() + 1);
  const year = Number(url.searchParams.get("year") ?? now.getFullYear());

  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 3000) {
    return NextResponse.json({ error: "Invalid month or year." }, { status: 400 });
  }

  try {
    const trendMonths = Array.from({ length: 6 }).map((_, index) => shiftMonth(year, month, index - 5));

    const [selectedPayrolls, trendPayrolls, staffList] = await Promise.all([
      prisma.payroll.findMany({
        where: { tenantId, month, year },
        select: {
          id: true,
          baseSalary: true,
          commissionAmount: true,
          leaveDeduction: true,
          netPay: true,
          staffId: true,
          staff: { select: { name: true } },
        },
        orderBy: { netPay: "desc" },
      }),
      prisma.payroll.findMany({
        where: {
          tenantId,
          OR: trendMonths.map((entry) => ({ month: entry.month, year: entry.year })),
        },
        select: { month: true, year: true, netPay: true },
      }),
      prisma.staff.findMany({
        where: {
          tenantId,
          status: "ACTIVE",
          baseSalary: { not: null },
          commissionRate: { not: null },
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const summary = selectedPayrolls.reduce(
      (acc, payroll) => {
        acc.totalStaffPaid += 1;
        acc.totalBaseSalary += Number(payroll.baseSalary);
        acc.totalCommission += Number(payroll.commissionAmount);
        acc.totalDeductions += Number(payroll.leaveDeduction);
        acc.totalNetPay += Number(payroll.netPay);
        return acc;
      },
      { totalStaffPaid: 0, totalBaseSalary: 0, totalCommission: 0, totalDeductions: 0, totalNetPay: 0 },
    );

    summary.totalBaseSalary = roundMoney(summary.totalBaseSalary);
    summary.totalCommission = roundMoney(summary.totalCommission);
    summary.totalDeductions = roundMoney(summary.totalDeductions);
    summary.totalNetPay = roundMoney(summary.totalNetPay);

    const trendByKey = new Map<string, number>();
    for (const payroll of trendPayrolls) {
      const key = `${payroll.year}-${payroll.month}`;
      trendByKey.set(key, (trendByKey.get(key) ?? 0) + Number(payroll.netPay));
    }

    const payrollTrend = trendMonths.map((entry) => ({
      month: `${monthLabels[entry.month - 1]} ${entry.year}`,
      totalNetPay: roundMoney(trendByKey.get(`${entry.year}-${entry.month}`) ?? 0),
    }));

    const staffBreakdown = selectedPayrolls.map((payroll) => ({
      payrollId: payroll.id,
      staffId: payroll.staffId,
      staffName: payroll.staff.name,
      baseSalary: Number(payroll.baseSalary),
      commission: Number(payroll.commissionAmount),
      deduction: Number(payroll.leaveDeduction),
      netPay: Number(payroll.netPay),
    }));

    const commissionVsBase = staffBreakdown.map((row) => ({
      staffName: row.staffName,
      baseSalary: row.baseSalary,
      commission: row.commission,
    }));

    const paidStaffIds = new Set(selectedPayrolls.map((payroll) => payroll.staffId));
    const unpaidStaff = staffList
      .filter((staff) => !paidStaffIds.has(staff.id))
      .map((staff) => ({ staffId: staff.id, staffName: staff.name, reason: "Payroll not yet generated" }));

    return NextResponse.json({
      month,
      year,
      summary,
      payrollTrend,
      staffBreakdown,
      commissionVsBase,
      unpaidStaff,
    });
  } catch (error) {
    console.error("Failed to load payroll report", error);
    return NextResponse.json({ error: "Unable to load payroll report." }, { status: 500 });
  }
}
