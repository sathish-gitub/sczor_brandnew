import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBusinessHoursForDate } from "@/lib/businessHours";
import {
  emptyAttendanceStatusCounts,
  resolveAttendanceDisplayStatus,
  type AttendanceStatusValue,
  type DisplayAttendanceStatus,
} from "@/lib/attendanceStatus";
import { istDayBounds, todayISTDateString } from "@/lib/time";
import { getStaffDesignationName, staffDesignationSelect } from "@/lib/staffDesignation";

function summarize(items: Array<{ displayStatus: DisplayAttendanceStatus }>) {
  const counts = emptyAttendanceStatusCounts();
  let notMarked = 0;

  for (const item of items) {
    if (item.displayStatus === "NOT_MARKED") {
      notMarked += 1;
    } else {
      counts[item.displayStatus] += 1;
    }
  }

  return {
    present: counts.PRESENT,
    absent: counts.ABSENT,
    leave: counts.LEAVE,
    weekOff: counts.WEEK_OFF,
    halfDay: counts.HALF_DAY,
    notMarked,
    total: items.length,
  };
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date")?.trim();
  const rawStaffParam = url.searchParams.get("staffId")?.trim();
  const staffId = rawStaffParam && rawStaffParam !== "ALL" ? rawStaffParam : null;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Valid date is required." }, { status: 400 });
  }

  if (date > todayISTDateString()) {
    return NextResponse.json({ error: "Future date is not allowed." }, { status: 400 });
  }

  const { start, end } = istDayBounds(date);
  const tenantId = session.user.tenantId;

  try {
    const businessHours = await getBusinessHoursForDate({ tenantId, dateStr: date });

    const [staffList, attendance] = await Promise.all([
      prisma.staff.findMany({
        where: {
          tenantId,
          status: "ACTIVE",
          ...(staffId ? { id: staffId } : {}),
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          ...staffDesignationSelect,
        },
      }),
      prisma.attendance.findMany({
        where: {
          tenantId,
          date: {
            gte: start,
            lt: end,
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
    const isBusinessWorkingDay = !businessHours.closed;

    const items = staffList.map((staff) => {
      const storedStatus = (statusByStaff.get(staff.id)?.status ?? null) as AttendanceStatusValue | null;

      return {
        staffId: staff.id,
        name: staff.name,
        designation: getStaffDesignationName(staff),
        attendanceId: statusByStaff.get(staff.id)?.id ?? null,
        status: storedStatus,
        displayStatus: resolveAttendanceDisplayStatus({ storedStatus, isBusinessWorkingDay }),
      };
    });

    return NextResponse.json({
      date,
      isBusinessWorkingDay,
      items,
      summary: summarize(items),
    });
  } catch (error) {
    console.error("Failed to load attendance", error);
    return NextResponse.json({ error: "Unable to load attendance." }, { status: 500 });
  }
}
