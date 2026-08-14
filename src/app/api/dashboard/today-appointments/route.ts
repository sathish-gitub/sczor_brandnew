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

    const appointments = await prisma.appointment.findMany({
      where: {
        tenantId,
        appointmentDate: { gte: today, lt: tomorrow },
      },
      include: {
        customer: {
          select: {
            name: true,
            mobile: true,
          },
        },
        service: {
          select: {
            name: true,
            price: true,
          },
        },
        staff: {
          select: {
            name: true,
            designation: true,
          },
        },
      },
      orderBy: { appointmentTime: "asc" },
    });

    return NextResponse.json(appointments);
  } catch (error) {
    console.error("Appointments error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}