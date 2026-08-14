import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const staff = await prisma.staff.findMany({
      where: {
        tenantId,
      },
      include: {
        attendances: {
          where: {
            date: { gte: today, lt: tomorrow },
          },
          take: 1,
        },
        appointments: {
          where: {
            appointmentDate: { gte: today, lt: tomorrow },
            status: { notIn: ["CANCELLED"] },
          },
        },
        _count: {
          select: {
            appointments: true,
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
        todayAppointments: s.appointments.length,
        totalAppointments: s._count.appointments,
      };
    });

    return NextResponse.json(staffWithStatus);
  } catch (error) {
    console.error("Staff error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}