import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServicesDoneByStaff, getStaffRevenueByInvoiceLine } from "@/lib/staffRevenue";
import { istMonthBounds, istWallTimeToInstant, todayISTDateString } from "@/lib/time";
import { getStaffDesignationName, staffDesignationSelect } from "@/lib/staffDesignation";

/** "YYYY-MM-DD" -> the start of the NEXT IST day, i.e. an exclusive upper bound. */
function parseISTDateExclusiveEnd(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const start = istWallTimeToInstant(value, "00:00");
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

function parseISTDateStart(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  return istWallTimeToInstant(value, "00:00");
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const startDate = parseISTDateStart(url.searchParams.get("startDate"));
  const endDate = parseISTDateExclusiveEnd(url.searchParams.get("endDate"));
  const staffId = url.searchParams.get("staffId")?.trim() || undefined;

  const fallback = istMonthBounds(todayISTDateString());
  const from = startDate ?? fallback.start;
  const to = endDate ?? fallback.end;

  try {
    const staff = await prisma.staff.findMany({
      where: {
        tenantId: session.user.tenantId,
        ...(staffId && staffId !== "ALL" ? { id: staffId } : {}),
      },
      select: {
        id: true,
        name: true,
        ...staffDesignationSelect,
      },
      orderBy: {
        name: "asc",
      },
    });

    const staffIds = staff.map((item) => item.id);

    const [servicesDoneByStaff, revenueByStaff, attendance] = await Promise.all([
      // "Services done" counts AppointmentService lines (the same person on two
      // lines of one appointment counts 2), restricted to BILLED appointments.
      getServicesDoneByStaff(session.user.tenantId, staffIds, { gte: from, lt: to }, "BILLED"),
      // Revenue is attributed per invoice line (InvoiceItem.staffId), falling
      // back to Invoice.staffId for lines that predate per-line attribution.
      getStaffRevenueByInvoiceLine(session.user.tenantId, staffIds, { gte: from, lt: to }),
      prisma.attendance.findMany({
        where: {
          tenantId: session.user.tenantId,
          staffId: {
            in: staffIds,
          },
          date: {
            gte: from,
            lt: to,
          },
        },
        select: {
          staffId: true,
          status: true,
        },
      }),
    ]);

    const attendanceByStaff = new Map<string, { present: number; absent: number; total: number }>();
    for (const row of attendance) {
      const entry = attendanceByStaff.get(row.staffId) ?? { present: 0, absent: 0, total: 0 };
      if (row.status === "PRESENT" || row.status === "HALF_DAY") {
        entry.present += 1;
      }
      if (row.status === "ABSENT" || row.status === "LEAVE") {
        entry.absent += 1;
      }
      entry.total += 1;
      attendanceByStaff.set(row.staffId, entry);
    }

    const items = staff.map((member) => {
      const servicesDoneInfo = servicesDoneByStaff.get(member.id) ?? { count: 0, servicesByName: {} };
      const revenueInfo = revenueByStaff.get(member.id) ?? { revenue: 0, invoiceIds: new Set<string>() };
      const revenue = revenueInfo.revenue;
      const attendanceInfo = attendanceByStaff.get(member.id) ?? { present: 0, absent: 0, total: 0 };
      const attendancePercent =
        attendanceInfo.total > 0 ? Math.round((attendanceInfo.present / attendanceInfo.total) * 100) : 0;

      const topServices = Object.entries(servicesDoneInfo.servicesByName)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name);

      const invoiceCount = revenueInfo.invoiceIds.size;

      return {
        staffId: member.id,
        name: member.name,
        designation: getStaffDesignationName(member),
        servicesDone: servicesDoneInfo.count,
        revenue,
        invoices: invoiceCount,
        avgInvoice: invoiceCount > 0 ? Math.round((revenue / invoiceCount) * 100) / 100 : 0,
        attendancePercent,
        presentDays: attendanceInfo.present,
        absentDays: attendanceInfo.absent,
        topServices,
      };
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Failed to load staff report", error);
    return NextResponse.json({ error: "Unable to load staff report." }, { status: 500 });
  }
}
