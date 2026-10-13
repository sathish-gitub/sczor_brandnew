import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentISTMonthYear, endOfMonthIST, startOfMonthIST } from "@/lib/time";
import { getStaffDesignationName, staffDesignationSelect } from "@/lib/staffDesignation";

function monthBounds(year: number, month: number) {
  return { start: startOfMonthIST(year, month), end: endOfMonthIST(year, month) };
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const defaults = currentISTMonthYear();
  const month = Number(url.searchParams.get("month") ?? defaults.month);
  const year = Number(url.searchParams.get("year") ?? defaults.year);

  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 3000) {
    return NextResponse.json({ error: "Invalid month or year." }, { status: 400 });
  }

  const { start, end } = monthBounds(year, month);

  try {
    const staffList = await prisma.staff.findMany({
      where: {
        tenantId: session.user.tenantId,
        status: "ACTIVE",
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        ...staffDesignationSelect,
        baseSalary: true,
        commissionRate: true,
        salaryHistory: {
          orderBy: { effectiveFrom: "desc" },
          select: { baseSalary: true, commissionRate: true, effectiveFrom: true, effectiveTo: true },
        },
      },
    });

    const staffIds = staffList.map((item) => item.id);

    const attendance = await prisma.attendance.findMany({
      where: {
        tenantId: session.user.tenantId,
        staffId: { in: staffIds },
        date: { gte: start, lt: end },
      },
      select: { staffId: true, status: true },
    });

    const attendanceByStaff = new Map<string, { PRESENT: number; ABSENT: number; LEAVE: number; HALF_DAY: number; WEEK_OFF: number }>();

    for (const entry of attendance) {
      const counts = attendanceByStaff.get(entry.staffId) ?? { PRESENT: 0, ABSENT: 0, LEAVE: 0, HALF_DAY: 0, WEEK_OFF: 0 };
      counts[entry.status] += 1;
      attendanceByStaff.set(entry.staffId, counts);
    }

    const payrolls = await prisma.payroll.findMany({
      where: {
        tenantId: session.user.tenantId,
        staffId: { in: staffIds },
        month,
        year,
      },
      select: { id: true, staffId: true, status: true },
    });

    const payrollByStaff = new Map(payrolls.map((entry) => [entry.staffId, entry]));

    const items = staffList.map((staff) => {
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

      const attendanceCounts = attendanceByStaff.get(staff.id) ?? { PRESENT: 0, ABSENT: 0, LEAVE: 0, HALF_DAY: 0, WEEK_OFF: 0 };
      const payroll = payrollByStaff.get(staff.id) ?? null;

      return {
        id: staff.id,
        name: staff.name,
        designation: getStaffDesignationName(staff),
        baseSalary,
        commissionRate,
        salaryConfigured: baseSalary !== null && commissionRate !== null,
        attendance: attendanceCounts,
        payrollId: payroll?.id ?? null,
        payrollStatus: payroll?.status ?? null,
      };
    });

    return NextResponse.json({ month, year, items });
  } catch (error) {
    console.error("Failed to load payroll staff overview", error);
    return NextResponse.json({ error: "Unable to load payroll overview." }, { status: 500 });
  }
}
