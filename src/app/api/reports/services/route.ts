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

  const fallback = monthBounds();
  const from = startDate ?? fallback.start;
  const to = endDate ?? fallback.end;

  try {
    const items = await prisma.invoiceItem.findMany({
      where: {
        invoice: {
          tenantId: session.user.tenantId,
          paymentStatus: "PAID",
          invoiceDate: {
            gte: from,
            lte: to,
          },
        },
      },
      select: {
        name: true,
        quantity: true,
        amount: true,
      },
    });

    const totalRevenue = items.reduce((sum, item) => sum + Number(item.amount), 0);
    const grouped = new Map<string, { count: number; revenue: number }>();

    for (const item of items) {
      const bucket = grouped.get(item.name) ?? { count: 0, revenue: 0 };
      bucket.count += item.quantity;
      bucket.revenue += Number(item.amount);
      grouped.set(item.name, bucket);
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
