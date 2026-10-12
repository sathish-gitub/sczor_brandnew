import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { istDayBounds, todayISTDateString } from "@/lib/time";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const { start, end } = istDayBounds(todayISTDateString());

    const staff = await prisma.staff.findMany({
      where: {
        tenantId,
      },
      include: {
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
      const attendanceStatus = s.attendances[0]?.status || null;
      const isInactive = s.status === "INACTIVE";
      const availabilityStatus =
        isInactive || attendanceStatus === "ABSENT" || attendanceStatus === "LEAVE"
          ? "OFF_DUTY"
          : s.availabilityStatus;

      return {
        id: s.id,
        name: s.name,
        designation: s.designation,
        status: s.status,
        availabilityStatus,
        displayStatus: isInactive ? "INACTIVE" : availabilityStatus,
        todayAttendance: attendanceStatus,
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