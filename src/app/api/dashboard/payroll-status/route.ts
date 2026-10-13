import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentISTMonthYear, getISTDayOfMonth } from "@/lib/time";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const { year, month } = currentISTMonthYear();

  try {
    const [configuredStaff, payrolls] = await Promise.all([
      prisma.staff.findMany({
        where: {
          tenantId,
          status: "ACTIVE",
          baseSalary: { not: null },
          commissionRate: { not: null },
        },
        select: { id: true },
      }),
      prisma.payroll.findMany({
        where: { tenantId, month, year },
        select: { staffId: true, netPay: true },
      }),
    ]);

    const paidStaffIds = new Set(payrolls.map((entry) => entry.staffId));
    const totalConfigured = configuredStaff.length;
    const totalProcessed = configuredStaff.filter((staff) => paidStaffIds.has(staff.id)).length;
    const totalNetPay = payrolls.reduce((sum, entry) => sum + Number(entry.netPay), 0);
    const unprocessedCount = totalConfigured - totalProcessed;

    return NextResponse.json({
      month,
      year,
      totalConfigured,
      totalProcessed,
      unprocessedCount,
      totalNetPay: Math.round(totalNetPay * 100) / 100,
      dayOfMonth: getISTDayOfMonth(new Date()),
    });
  } catch (error) {
    console.error("Failed to load payroll status", error);
    return NextResponse.json({ error: "Unable to load payroll status." }, { status: 500 });
  }
}
