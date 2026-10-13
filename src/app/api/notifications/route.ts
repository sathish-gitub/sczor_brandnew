import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { istDayBounds, todayISTDateString } from "@/lib/time";

type Notification = {
  id: string;
  type: "APPOINTMENT" | "INVOICE" | "ATTENDANCE";
  message: string;
  href: string;
  createdAt: string;
};

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const { start, end } = istDayBounds(todayISTDateString());

  try {
    const [appointments, invoices, attendances] = await Promise.all([
      prisma.appointment.findMany({
        where: { tenantId, appointmentDate: { gte: start, lt: end } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          appointmentTime: true,
          createdAt: true,
          customer: { select: { name: true } },
        },
      }),
      prisma.invoice.findMany({
        where: { tenantId, invoiceDate: { gte: start, lt: end } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          paymentStatus: true,
          createdAt: true,
        },
      }),
      prisma.attendance.findMany({
        where: { tenantId, date: { gte: start, lt: end }, status: { in: ["ABSENT", "LEAVE"] } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          createdAt: true,
          staff: { select: { name: true } },
        },
      }),
    ]);

    const notifications: Notification[] = [
      ...appointments.map((item) => ({
        id: `appointment-${item.id}`,
        type: "APPOINTMENT" as const,
        message: `New appointment booked - ${item.customer.name} at ${item.appointmentTime}`,
        href: `/appointments/${item.id}`,
        createdAt: item.createdAt.toISOString(),
      })),
      ...invoices.map((item) => ({
        id: `invoice-${item.id}`,
        type: "INVOICE" as const,
        message: `Invoice ${item.invoiceNumber} ${item.paymentStatus.toLowerCase()} - ₹${Number(item.total)}`,
        href: `/billing/invoices/${item.id}`,
        createdAt: item.createdAt.toISOString(),
      })),
      ...attendances.map((item) => ({
        id: `attendance-${item.id}`,
        type: "ATTENDANCE" as const,
        message: `Staff ${item.staff.name} marked ${item.status.toLowerCase()}`,
        href: "/attendance",
        createdAt: item.createdAt.toISOString(),
      })),
    ]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 10);

    return NextResponse.json({ items: notifications, count: notifications.length });
  } catch (error) {
    console.error("Failed to load notifications", error);
    const message = error instanceof Error ? error.message : "Unable to load notifications.";
    return NextResponse.json({ error: "Unable to load notifications.", message }, { status: 500 });
  }
}
