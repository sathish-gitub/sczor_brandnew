import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const payroll = await prisma.payroll.findFirst({
      where: { id, tenantId: session.user.tenantId },
      include: {
        staff: { select: { name: true, designation: true } },
      },
    });

    if (!payroll) {
      return NextResponse.json({ error: "Payroll record not found." }, { status: 404 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: {
        name: true,
        logo: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        phone: true,
        email: true,
      },
    });

    return NextResponse.json({
      payroll: {
        id: payroll.id,
        payslipNumber: payroll.payslipNumber,
        month: payroll.month,
        year: payroll.year,
        status: payroll.status,
        generatedAt: payroll.generatedAt,
        staffName: payroll.staff.name,
        designation: payroll.staff.designation,
        baseSalary: Number(payroll.baseSalary),
        commissionRate: Number(payroll.commissionRate),
        commissionAmount: Number(payroll.commissionAmount),
        revenueGenerated: Number(payroll.revenueGenerated),
        presentDays: payroll.presentDays,
        absentDays: payroll.absentDays,
        leaveDays: payroll.leaveDays,
        halfDays: payroll.halfDays,
        paidLeaveDays: payroll.paidLeaveDays,
        lopDays: Number(payroll.lopDays),
        totalWorkingDays: payroll.totalWorkingDays,
        leaveDeduction: Number(payroll.leaveDeduction),
        grossPay: Number(payroll.grossPay),
        netPay: Number(payroll.netPay),
      },
      tenant,
    });
  } catch (error) {
    console.error("Failed to load payroll record", error);
    return NextResponse.json({ error: "Unable to load payroll record." }, { status: 500 });
  }
}
