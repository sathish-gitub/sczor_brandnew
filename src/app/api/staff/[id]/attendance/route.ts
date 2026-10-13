import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentISTMonthYear, endOfMonthIST, startOfMonthIST } from "@/lib/time";

async function tenantIdOrNull() {
  const session = await getServerSession(authOptions);
  return session?.user.tenantId ?? null;
}

function monthBounds(month?: number, year?: number) {
  const defaults = currentISTMonthYear();
  const targetMonth = month ?? defaults.month;
  const targetYear = year ?? defaults.year;

  return { start: startOfMonthIST(targetYear, targetMonth), end: endOfMonthIST(targetYear, targetMonth) };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await tenantIdOrNull();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const url = new URL(request.url);

  const month = Number(url.searchParams.get("month") ?? "") || undefined;
  const year = Number(url.searchParams.get("year") ?? "") || undefined;
  const bounds = monthBounds(month, year);

  const attendance = await prisma.attendance.findMany({
    where: {
      tenantId,
      staffId: id,
      date: {
        gte: bounds.start,
        lt: bounds.end,
      },
    },
    orderBy: {
      date: "asc",
    },
  });

  return NextResponse.json({
    items: attendance,
  });
}
