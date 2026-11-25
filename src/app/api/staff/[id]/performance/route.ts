import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStaffServiceCategoryBreakdown } from "@/lib/staffRevenue";
import { addISTCalendarMonths, istMonthBounds, todayISTDateString, toISTDateString } from "@/lib/time";

type Period = "this_month" | "last_month" | "all";

function resolveRange(period: Period): { gte: Date; lt: Date } | undefined {
  if (period === "all") {
    return undefined;
  }

  const today = todayISTDateString();

  if (period === "this_month") {
    const bounds = istMonthBounds(today);
    return { gte: bounds.start, lt: bounds.end };
  }

  // last_month
  const lastMonthDate = addISTCalendarMonths(istMonthBounds(today).start, -1);
  const bounds = istMonthBounds(toISTDateString(lastMonthDate));
  return { gte: bounds.start, lt: bounds.end };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const tenantId = session?.user.tenantId;

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const url = new URL(request.url);
  const periodParam = url.searchParams.get("period");
  const period: Period = periodParam === "this_month" || periodParam === "last_month" ? periodParam : "all";

  try {
    const staff = await prisma.staff.findFirst({ where: { id, tenantId }, select: { id: true } });

    if (!staff) {
      return NextResponse.json({ error: "Staff not found." }, { status: 404 });
    }

    const range = resolveRange(period);
    const breakdown = await getStaffServiceCategoryBreakdown(tenantId, id, range);

    return NextResponse.json({ period, ...breakdown });
  } catch (error) {
    console.error("Staff performance fetch error:", { id, tenantId, error });
    return NextResponse.json({ error: "Failed to fetch staff performance." }, { status: 500 });
  }
}
