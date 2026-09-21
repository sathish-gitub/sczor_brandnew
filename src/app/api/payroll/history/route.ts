import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const staffId = url.searchParams.get("staffId")?.trim() || undefined;
  const yearParam = url.searchParams.get("year");
  const year = yearParam ? Number(yearParam) : undefined;

  if (year !== undefined && (!Number.isInteger(year) || year < 2000 || year > 3000)) {
    return NextResponse.json({ error: "Invalid year." }, { status: 400 });
  }

  try {
    const payrolls = await prisma.payroll.findMany({
      where: {
        tenantId: session.user.tenantId,
        ...(staffId ? { staffId } : {}),
        ...(year ? { year } : {}),
      },
      select: {
        id: true,
        month: true,
        year: true,
        netPay: true,
        payslipNumber: true,
        generatedAt: true,
        staffId: true,
        staff: { select: { name: true } },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }, { generatedAt: "desc" }],
    });

    const staffList = await prisma.staff.findMany({
      where: { tenantId: session.user.tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      items: payrolls.map((payroll) => ({
        id: payroll.id,
        staffId: payroll.staffId,
        staffName: payroll.staff.name,
        month: payroll.month,
        year: payroll.year,
        netPay: Number(payroll.netPay),
        payslipNumber: payroll.payslipNumber,
        generatedAt: payroll.generatedAt,
      })),
      staffOptions: staffList,
    });
  } catch (error) {
    console.error("Failed to load payroll history", error);
    return NextResponse.json({ error: "Unable to load payroll history." }, { status: 500 });
  }
}
