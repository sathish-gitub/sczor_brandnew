import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { istDayBounds } from "@/lib/time";

async function tenantIdOrNull() {
  const session = await getServerSession(authOptions);
  return session?.user.tenantId ?? null;
}

export async function GET(request: Request) {
  const tenantId = await tenantIdOrNull();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const time = url.searchParams.get("time");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Valid date is required." }, { status: 400 });
  }

  const bounds = istDayBounds(date);

  const staff = await prisma.staff.findMany({
    where: {
      tenantId,
      status: "ACTIVE",
    },
    orderBy: {
      name: "asc",
    },
    include: {
      attendances: {
        where: {
          date: {
            gte: bounds.start,
            lt: bounds.end,
          },
        },
        take: 1,
      },
      appointments: {
        where: {
          appointmentDate: {
            gte: bounds.start,
            lt: bounds.end,
          },
          status: {
            not: "CANCELLED",
          },
          appointmentTime: time || undefined,
        },
        select: {
          id: true,
        },
      },
    },
  });

  const items = staff
    .map((member) => {
      const attendance = member.attendances[0]?.status;
      const unavailableByAttendance = attendance === "ABSENT" || attendance === "LEAVE";
      const unavailableByBooking = member.appointments.length > 0;
      const unavailableByStatus = member.availabilityStatus !== "AVAILABLE";

      const available = !unavailableByAttendance && !unavailableByBooking && !unavailableByStatus;

      return {
        id: member.id,
        name: member.name,
        designation: member.designation,
        available,
        reason: unavailableByAttendance
          ? "Off duty"
          : unavailableByBooking
            ? "Already booked"
            : unavailableByStatus
              ? member.availabilityStatus
              : null,
      };
    })
    .filter((item) => item.available);

  return NextResponse.json({
    items,
  });
}
