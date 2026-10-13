import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countISTWorkingDaysInRange, istDayBounds, istMonthBounds, istWeekBounds, istYearBounds, todayISTDateString } from "@/lib/time";

function rangeBounds(range: string | null, from: string | null, to: string | null) {
  const todayStr = todayISTDateString();

  if (range === "week") {
    return istWeekBounds(todayStr);
  }

  if (range === "month") {
    return istMonthBounds(todayStr);
  }

  if (range === "year") {
    return istYearBounds(todayStr);
  }

  if (range === "custom" && from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { start: istDayBounds(from).start, end: istDayBounds(to).end };
  }

  return istDayBounds(todayStr);
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const range = url.searchParams.get("range");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const tenantId = session.user.tenantId;
    const { start, end } = rangeBounds(range, from, to);
    const isSingleDayRange = range === null || range === "today";

    const [tenant, todayAppointments, todayRevenue, newCustomers, presentAttendanceCount, totalStaff] =
      await Promise.all([
        prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { workingDays: true },
        }),
        prisma.appointment.count({
          where: {
            tenantId,
            appointmentDate: { gte: start, lt: end },
          },
        }),
        prisma.invoice.aggregate({
          where: {
            tenantId,
            createdAt: { gte: start, lt: end },
            paymentStatus: "PAID",
          },
          _sum: { total: true },
        }),
        prisma.customer.count({
          where: {
            tenantId,
            createdAt: { gte: start, lt: end },
          },
        }),
        prisma.attendance.count({
          where: {
            tenantId,
            date: { gte: start, lt: end },
            status: "PRESENT",
          },
        }),
        prisma.staff.count({
          where: {
            tenantId,
            status: "ACTIVE",
          },
        }),
      ]);

    let staffPresent = presentAttendanceCount;
    const staffPresentIsAverage = !isSingleDayRange;

    if (staffPresentIsAverage) {
      const workingDays = countISTWorkingDaysInRange(start, end, tenant?.workingDays ?? []);
      staffPresent = workingDays > 0 ? Math.round(presentAttendanceCount / workingDays) : 0;
    }

    // Defensive cap: the average (or raw count) should never exceed the total active staff count.
    staffPresent = Math.min(staffPresent, totalStaff);

    return NextResponse.json(
      {
        todayAppointments,
        todayRevenue: Number(todayRevenue._sum.total || 0),
        newCustomers,
        staffPresent,
        staffPresentIsAverage,
        totalStaff,
        range: range ?? "today",
      },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (error) {
    console.error("Stats error:", error);
    const message = error instanceof Error ? error.message : "Failed to load stats.";
    return NextResponse.json({ error: "Failed", message }, { status: 500 });
  }
}