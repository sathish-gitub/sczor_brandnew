import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { combinedServiceNames, distinctStaffLabel } from "@/lib/appointmentDisplay";
import { istDayBounds, todayISTDateString } from "@/lib/time";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const { start, end } = istDayBounds(todayISTDateString());

    const appointments = await prisma.appointment.findMany({
      where: {
        tenantId,
        appointmentDate: { gte: start, lt: end },
      },
      include: {
        customer: {
          select: {
            name: true,
            mobile: true,
          },
        },
        services: {
          orderBy: { sortOrder: "asc" },
          select: {
            service: { select: { name: true } },
            staff: { select: { name: true } },
          },
        },
      },
      orderBy: { appointmentTime: "asc" },
    });

    const response = appointments.map((appointment) => ({
      id: appointment.id,
      appointmentTime: appointment.appointmentTime,
      status: appointment.status,
      customer: appointment.customer,
      serviceName: combinedServiceNames(appointment.services),
      staffName: distinctStaffLabel(appointment.services),
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error("Appointments error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}