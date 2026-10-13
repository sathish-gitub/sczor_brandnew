import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBusinessHoursForDate } from "@/lib/businessHours";
import { resolveAttendanceDisplayStatus, type AttendanceStatusValue } from "@/lib/attendanceStatus";
import { istDayBounds, todayISTDateString } from "@/lib/time";
import { getStaffDesignationName } from "@/lib/staffDesignation";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const today = todayISTDateString();
    const { start, end } = istDayBounds(today);

    const businessHours = await getBusinessHoursForDate({ tenantId, dateStr: today });
    const isBusinessWorkingDay = !businessHours.closed;

    const staff = await prisma.staff.findMany({
      where: {
        tenantId,
      },
      include: {
        staffDesignation: { select: { name: true } },
        attendances: {
          where: {
            date: { gte: start, lt: end },
          },
          take: 1,
        },
        appointmentServices: {
          where: {
            appointment: {
              appointmentDate: { gte: start, lt: end },
              status: { notIn: ["CANCELLED"] },
            },
          },
        },
        _count: {
          select: {
            appointmentServices: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    const staffWithStatus = staff.map((s) => {
      const storedStatus = (s.attendances[0]?.status as AttendanceStatusValue | undefined) ?? null;
      const isInactive = s.status === "INACTIVE";

      // Inactive staff show their own "Inactive" status (a staff-account
      // state, not an attendance status); active staff show one of the
      // five attendance statuses or "Not Marked" via the shared rule.
      const displayStatus = isInactive
        ? "INACTIVE"
        : resolveAttendanceDisplayStatus({ storedStatus, isBusinessWorkingDay });

      return {
        id: s.id,
        name: s.name,
        designation: getStaffDesignationName(s),
        status: s.status,
        displayStatus,
        todayAttendance: storedStatus,
        todayAppointments: s.appointmentServices.length,
        totalAppointments: s._count.appointmentServices,
      };
    });

    return NextResponse.json(staffWithStatus);
  } catch (error) {
    console.error("Staff error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
