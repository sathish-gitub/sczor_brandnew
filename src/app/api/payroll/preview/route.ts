import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { calculatePayroll, PayrollCalculationError, type PayrollCalculationResult } from "@/lib/payrollCalculation";
import { prisma } from "@/lib/prisma";

const payloadSchema = z
  .object({
    staffId: z.string().cuid().optional(),
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2000).max(3000),
    generateForAll: z.boolean().optional().default(false),
  })
  .refine((data) => data.generateForAll || !!data.staffId, {
    message: "staffId is required unless generateForAll is true.",
  });

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const { staffId, month, year, generateForAll } = parsed.data;

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

    const previews: Array<{
      staffId: string;
      staffName: string;
      result?: PayrollCalculationResult;
      error?: string;
    }> = [];

    for (const staff of staffList) {
      try {
        const result = await calculatePayroll(staff.id, month, year, tenantId);
        previews.push({ staffId: staff.id, staffName: staff.name, result });
      } catch (error) {
        previews.push({
          staffId: staff.id,
          staffName: staff.name,
          error: error instanceof PayrollCalculationError ? error.message : "Unable to calculate payroll.",
        });
      }
    }

    return NextResponse.json({ previews });
  }

  try {
    const result = await calculatePayroll(staffId!, month, year, tenantId);
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof PayrollCalculationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Failed to preview payroll", error);
    return NextResponse.json({ error: "Unable to calculate payroll preview." }, { status: 500 });
  }
}
