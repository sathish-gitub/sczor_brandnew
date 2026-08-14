import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LEAVE" | "HALF_DAY";

function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00`);
}

function dayBounds(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function zeroSummary() {
  return {
    present: 0,
    absent: 0,
    leave: 0,
    halfDay: 0,
    total: 0,
  };
}

function summarize(items: Array<{ status: AttendanceStatus | null }>) {
  const summary = zeroSummary();

  for (const item of items) {
    if (item.status === "PRESENT") {
      summary.present += 1;
    } else if (item.status === "ABSENT") {
      summary.absent += 1;
    } else if (item.status === "LEAVE") {
      summary.leave += 1;
    } else if (item.status === "HALF_DAY") {
      summary.halfDay += 1;
    }

    if (item.status) {
      summary.total += 1;
    }
  }

  return summary;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date")?.trim();

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Valid date is required." }, { status: 400 });
  }

  const parsedDate = parseDateOnly(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (parsedDate > today) {
    return NextResponse.json({ error: "Future date is not allowed." }, { status: 400 });
  }

  const { start, end } = dayBounds(parsedDate);

  try {
    const [staffList, attendance] = await Promise.all([
      prisma.staff.findMany({
        where: {
          tenantId: session.user.tenantId,
          status: "ACTIVE",
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          designation: true,
        },
      }),
      prisma.attendance.findMany({
        where: {
          tenantId: session.user.tenantId,
          date: {
            gte: start,
            lte: end,
          },
        },
        select: {
          id: true,
          staffId: true,
          status: true,
        },
      }),
    ]);

    const statusByStaff = new Map(attendance.map((item) => [item.staffId, item]));

    const items = staffList.map((staff) => ({
      staffId: staff.id,
      name: staff.name,
      designation: staff.designation,
      attendanceId: statusByStaff.get(staff.id)?.id ?? null,
      status: (statusByStaff.get(staff.id)?.status ?? null) as AttendanceStatus | null,
    }));

    return NextResponse.json({
      date,
      items,
      summary: summarize(items),
    });
  } catch (error) {
    console.error("Failed to load attendance", error);
    return NextResponse.json({ error: "Unable to load attendance." }, { status: 500 });
  }
}
