import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parseDate(value: string | null, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }

  return date;
}

function monthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const startDate = parseDate(url.searchParams.get("startDate"));
  const endDate = parseDate(url.searchParams.get("endDate"), true);
  const staffId = url.searchParams.get("staffId")?.trim() || undefined;

  const fallback = monthBounds();
  const from = startDate ?? fallback.start;
  const to = endDate ?? fallback.end;

  try {
    const staff = await prisma.staff.findMany({
      where: {
        tenantId: session.user.tenantId,
        ...(staffId && staffId !== "ALL" ? { id: staffId } : {}),
      },
      select: {
        id: true,
        name: true,
        designation: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    const staffIds = staff.map((item) => item.id);

    const [appointments, invoices, attendance] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          tenantId: session.user.tenantId,
          staffId: { in: staffIds },
          appointmentDate: { gte: from, lte: to },
          status: "BILLED",
        },
        select: {
          id: true,
          staffId: true,
          service: { select: { name: true } },
        },
      }),
      // Revenue = all PAID invoices attributed to this staff (walk-in + appointment)
      prisma.invoice.findMany({
        where: {
          tenantId: session.user.tenantId,
          staffId: { in: staffIds },
          paymentStatus: "PAID",
          invoiceDate: { gte: from, lte: to },
        },
        select: {
          id: true,
          staffId: true,
          total: true,
        },
      }),
      prisma.attendance.findMany({
        where: {
          tenantId: session.user.tenantId,
          staffId: {
            in: staffIds,
          },
          date: {
            gte: from,
            lte: to,
          },
        },
        select: {
          staffId: true,
          status: true,
        },
      }),
    ]);

    const appointmentByStaff = new Map<string, number>();
    const serviceMixByStaff = new Map<string, Record<string, number>>();
    for (const entry of appointments) {
      appointmentByStaff.set(entry.staffId, (appointmentByStaff.get(entry.staffId) ?? 0) + 1);

      const mix = serviceMixByStaff.get(entry.staffId) ?? {};
      const name = entry.service.name;
      mix[name] = (mix[name] ?? 0) + 1;
      serviceMixByStaff.set(entry.staffId, mix);
    }

    const revenueByStaff = new Map<string, number>();
    const invoicesByStaff = new Map<string, number>();
    for (const inv of invoices) {
      const key = inv.staffId;
      if (!key) continue;
      revenueByStaff.set(key, (revenueByStaff.get(key) ?? 0) + Number(inv.total));
      invoicesByStaff.set(key, (invoicesByStaff.get(key) ?? 0) + 1);
    }

    const attendanceByStaff = new Map<string, { present: number; absent: number; total: number }>();
    for (const row of attendance) {
      const entry = attendanceByStaff.get(row.staffId) ?? { present: 0, absent: 0, total: 0 };
      if (row.status === "PRESENT" || row.status === "HALF_DAY") {
        entry.present += 1;
      }
      if (row.status === "ABSENT" || row.status === "LEAVE") {
        entry.absent += 1;
      }
      entry.total += 1;
      attendanceByStaff.set(row.staffId, entry);
    }

    const items = staff.map((member) => {
      const appointmentsCount = appointmentByStaff.get(member.id) ?? 0;
      const revenue = Math.round((revenueByStaff.get(member.id) ?? 0) * 100) / 100;
      const attendanceInfo = attendanceByStaff.get(member.id) ?? { present: 0, absent: 0, total: 0 };
      const attendancePercent =
        attendanceInfo.total > 0 ? Math.round((attendanceInfo.present / attendanceInfo.total) * 100) : 0;

      const topServices = Object.entries(serviceMixByStaff.get(member.id) ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name);

      const invoiceCount = invoicesByStaff.get(member.id) ?? 0;

      return {
        staffId: member.id,
        name: member.name,
        designation: member.designation,
        appointments: appointmentsCount,
        revenue,
        invoices: invoiceCount,
        avgInvoice: invoiceCount > 0 ? Math.round((revenue / invoiceCount) * 100) / 100 : 0,
        attendancePercent,
        presentDays: attendanceInfo.present,
        absentDays: attendanceInfo.absent,
        topServices,
      };
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Failed to load staff report", error);
    return NextResponse.json({ error: "Unable to load staff report." }, { status: 500 });
  }
}
