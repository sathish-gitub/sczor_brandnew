import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function rangeBounds(range: string | null, from: string | null, to: string | null) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (range === "week") {
    const day = (now.getDay() + 6) % 7;
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);
    end.setDate(start.getDate() + 7);
    end.setHours(0, 0, 0, 0);
    return { start, end };
  }

  if (range === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(start.getMonth() + 1, 1);
    end.setHours(0, 0, 0, 0);
    return { start, end };
  }

  if (range === "year") {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    end.setFullYear(start.getFullYear() + 1, 0, 1);
    end.setHours(0, 0, 0, 0);
    return { start, end };
  }

  if (range === "custom" && from && to) {
    const customStart = new Date(`${from}T00:00:00`);
    const customEnd = new Date(`${to}T00:00:00`);

    if (!Number.isNaN(customStart.getTime()) && !Number.isNaN(customEnd.getTime())) {
      customEnd.setDate(customEnd.getDate() + 1);
      return { start: customStart, end: customEnd };
    }
  }

  start.setHours(0, 0, 0, 0);
  end.setDate(start.getDate() + 1);
  end.setHours(0, 0, 0, 0);
  return { start, end };
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

    const [todayAppointments, todayRevenue, newCustomers, staffPresent, totalStaff] = await Promise.all([
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

    return NextResponse.json(
      {
        todayAppointments,
        todayRevenue: Number(todayRevenue._sum.total || 0),
        newCustomers,
        staffPresent,
        totalStaff,
        range: range ?? "today",
      },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}