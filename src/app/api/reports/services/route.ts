import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { istMonthBounds, istWallTimeToInstant, todayISTDateString } from "@/lib/time";

/** "YYYY-MM-DD" -> the start of the NEXT IST day, i.e. an exclusive upper bound. */
function parseISTDateExclusiveEnd(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const start = istWallTimeToInstant(value, "00:00");
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

function parseISTDateStart(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  return istWallTimeToInstant(value, "00:00");
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const startDate = parseISTDateStart(url.searchParams.get("startDate"));
  const endDate = parseISTDateExclusiveEnd(url.searchParams.get("endDate"));

  const fallback = istMonthBounds(todayISTDateString());
  const from = startDate ?? fallback.start;
  const to = endDate ?? fallback.end;

  try {
    const [items, serviceLines] = await Promise.all([
      prisma.invoiceItem.findMany({
        where: {
          invoice: {
            tenantId: session.user.tenantId,
            paymentStatus: "PAID",
            invoiceDate: {
              gte: from,
              lt: to,
            },
          },
        },
        select: {
          name: true,
          quantity: true,
          amount: true,
        },
      }),
      // Service popularity COUNT is AppointmentService lines (a service
      // chosen on 2 lines of one appointment counts twice; walk-in-only
      // sales have no lines and are naturally excluded from the count),
      // matching the dashboard chart's servicePopularity. Revenue stays the
      // actual billed amount from invoice items above.
      prisma.appointmentService.findMany({
        where: {
          tenantId: session.user.tenantId,
          appointment: { appointmentDate: { gte: from, lt: to } },
        },
        select: { service: { select: { name: true } } },
      }),
    ]);

    const totalRevenue = items.reduce((sum, item) => sum + Number(item.amount), 0);
    const grouped = new Map<string, { count: number; revenue: number }>();

    for (const item of items) {
      const bucket = grouped.get(item.name) ?? { count: 0, revenue: 0 };
      bucket.revenue += Number(item.amount);
      grouped.set(item.name, bucket);
    }

    for (const line of serviceLines) {
      const name = line.service.name;
      const bucket = grouped.get(name) ?? { count: 0, revenue: 0 };
      bucket.count += 1;
      grouped.set(name, bucket);
    }

    const rows = [...grouped.entries()]
      .map(([service, value]) => ({
        service,
        count: value.count,
        revenue: Math.round(value.revenue * 100) / 100,
        sharePercent: totalRevenue > 0 ? Math.round((value.revenue / totalRevenue) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({ items: rows, totalRevenue: Math.round(totalRevenue * 100) / 100 });
  } catch (error) {
    console.error("Failed to load services report", error);
    return NextResponse.json({ error: "Unable to load services report." }, { status: 500 });
  }
}
