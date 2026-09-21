import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/enforceAccess";
import { calculatePayroll, PayrollCalculationError } from "@/lib/payrollCalculation";
import { prisma } from "@/lib/prisma";

const payloadSchema = z
  .object({
    staffId: z.string().cuid().optional(),
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2000).max(3000),
    generateForAll: z.boolean().optional().default(false),
    regenerate: z.boolean().optional().default(false),
  })
  .refine((data) => data.generateForAll || !!data.staffId, {
    message: "staffId is required unless generateForAll is true.",
  });

async function nextPayslipNumber(tenantId: string, year: number, month: number) {
  const prefix = `PAY-${year}-${String(month).padStart(2, "0")}-`;

  const latest = await prisma.payroll.findFirst({
    where: { tenantId, payslipNumber: { startsWith: prefix } },
    orderBy: { payslipNumber: "desc" },
    select: { payslipNumber: true },
  });

  const lastSequence = latest ? Number(latest.payslipNumber.split("-").at(-1) ?? "0") : 0;
  const next = Number.isFinite(lastSequence) ? lastSequence + 1 : 1;

  return `${prefix}${String(next).padStart(4, "0")}`;
}

async function generateForStaff(tenantId: string, staffId: string, month: number, year: number, regenerate: boolean) {
  const existing = await prisma.payroll.findUnique({
    where: { staffId_month_year: { staffId, month, year } },
  });

  if (existing) {
    if (!regenerate) {
      throw new PayrollCalculationError("Payroll already generated for this month.");
    }
    await prisma.payroll.delete({ where: { id: existing.id } });
  }

  const result = await calculatePayroll(staffId, month, year, tenantId);
  const payslipNumber = await nextPayslipNumber(tenantId, year, month);

  return prisma.payroll.create({
    data: {
      staffId,
      tenantId,
      month,
      year,
      baseSalary: result.baseSalary,
      commissionRate: result.commissionRate,
      commissionAmount: result.commissionAmount,
      revenueGenerated: result.revenueGenerated,
      presentDays: result.presentDays,
      absentDays: result.absentDays,
      leaveDays: result.leaveDays,
      halfDays: result.halfDays,
      totalWorkingDays: result.totalWorkingDays,
      leaveDeduction: result.leaveDeduction,
      grossPay: result.grossPay,
      netPay: result.netPay,
      payslipNumber,
    },
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await checkWriteAccess(session.user.tenantId);
  if (!access.allowed) {
    return NextResponse.json({ error: "SUBSCRIPTION_REQUIRED", message: access.reason }, { status: 403 });
  }

  const tenantId = session.user.tenantId;

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const { staffId, month, year, generateForAll, regenerate } = parsed.data;

  if (generateForAll) {
    const staffList = await prisma.staff.findMany({
      where: {
        tenantId,
        status: "ACTIVE",
        baseSalary: { not: null },
        commissionRate: { not: null },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    const generated: Array<{ staffId: string; staffName: string; payrollId: string }> = [];
    const failed: Array<{ staffId: string; staffName: string; reason: string }> = [];

    for (const staff of staffList) {
      try {
        const payroll = await generateForStaff(tenantId, staff.id, month, year, regenerate);
        generated.push({ staffId: staff.id, staffName: staff.name, payrollId: payroll.id });
      } catch (error) {
        failed.push({
          staffId: staff.id,
          staffName: staff.name,
          reason: error instanceof PayrollCalculationError ? error.message : "Unable to generate payroll.",
        });
      }
    }

    return NextResponse.json({ generated, failed });
  }

  try {
    const payroll = await generateForStaff(tenantId, staffId!, month, year, regenerate);
    return NextResponse.json({ payroll });
  } catch (error) {
    if (error instanceof PayrollCalculationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Failed to generate payroll", error);
    return NextResponse.json({ error: "Unable to generate payroll." }, { status: 500 });
  }
}
