import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type StaffState = "AVAILABLE" | "BUSY" | "OFF_DUTY";

function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00`);
}

function dayBoundsFor(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function generateSlots(openTime: string, closeTime: string) {
  const [openHour, openMinute] = openTime.split(":").map(Number);
  const [closeHour, closeMinute] = closeTime.split(":").map(Number);

  let cursor = openHour * 60 + openMinute;
  const closeCursor = closeHour * 60 + closeMinute;
  const slots: string[] = [];

  while (cursor < closeCursor) {
    const hour = Math.floor(cursor / 60)
      .toString()
      .padStart(2, "0");
    const minute = (cursor % 60).toString().padStart(2, "0");
    slots.push(`${hour}:${minute}`);
    cursor += 30;
  }

  return slots;
}

function deriveStatus({
  attendanceStatus,
  baseAvailability,
  hasSameTimeBooking,
}: {
  attendanceStatus: "PRESENT" | "ABSENT" | "LEAVE" | "HALF_DAY" | null;
  baseAvailability: "AVAILABLE" | "BUSY" | "OFF_DUTY";
  hasSameTimeBooking: boolean;
}): StaffState {
  if (attendanceStatus === "ABSENT" || attendanceStatus === "LEAVE") {
    return "OFF_DUTY";
  }

  if (baseAvailability === "OFF_DUTY") {
    return "OFF_DUTY";
  }

  if (hasSameTimeBooking) {
    return "BUSY";
  }

  if (baseAvailability === "BUSY") {
    return "BUSY";
  }

  return "AVAILABLE";
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const staffId = url.searchParams.get("staffId");
  const selectedTime = url.searchParams.get("time") ?? undefined;
  const excludeAppointmentId = url.searchParams.get("excludeAppointmentId") ?? undefined;

  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: "Valid date is required." }, { status: 400 });
  }

  try {
    const targetDate = parseDateOnly(dateParam);
    const { start, end } = dayBoundsFor(targetDate);

    const [tenant, staffMembers] = await Promise.all([
      prisma.tenant.findUnique({
        where: {
          id: session.user.tenantId,
        },
        select: {
          openTime: true,
          closeTime: true,
        },
      }),
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
          availabilityStatus: true,
          attendances: {
            where: {
              date: {
                gte: start,
                lte: end,
              },
            },
            select: {
              status: true,
            },
            take: 1,
          },
          appointments: {
            where: {
              appointmentDate: {
                gte: start,
                lte: end,
              },
              status: {
                not: "CANCELLED",
              },
              id: excludeAppointmentId
                ? {
                    not: excludeAppointmentId,
                  }
                : undefined,
            },
            select: {
              id: true,
              appointmentTime: true,
            },
          },
        },
      }),
    ]);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    }

    const slots = generateSlots(tenant.openTime, tenant.closeTime);

    const staffAvailability = staffMembers.map((member) => {
      const attendanceStatus = member.attendances[0]?.status ?? null;
      const hasSameTimeBooking = selectedTime
        ? member.appointments.some((appointment) => appointment.appointmentTime === selectedTime)
        : false;

      return {
        id: member.id,
        name: member.name,
        designation: member.designation,
        status: deriveStatus({
          attendanceStatus,
          baseAvailability: member.availabilityStatus,
          hasSameTimeBooking,
        }),
        bookedTimes: member.appointments.map((appointment) => appointment.appointmentTime),
      };
    });

    const selectedStaff = staffId
      ? staffAvailability.find((member) => member.id === staffId)
      : undefined;

    const availableSlots = selectedStaff
      ? slots.filter((slot) => !selectedStaff.bookedTimes.includes(slot))
      : slots;

    return NextResponse.json({
      slots: availableSlots,
      allSlots: slots,
      staffAvailability,
    });
  } catch (error) {
    console.error("Failed to load availability", error);

    return NextResponse.json(
      {
        error: "Unable to load available slots.",
      },
      { status: 500 },
    );
  }
}
