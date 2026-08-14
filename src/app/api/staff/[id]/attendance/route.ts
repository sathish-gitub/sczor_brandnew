import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function tenantIdOrNull() {
  const session = await getServerSession(authOptions);
  return session?.user.tenantId ?? null;
}

function monthBounds(month?: number, year?: number) {
  const now = new Date();
  const targetMonth = month ?? now.getMonth() + 1;
  const targetYear = year ?? now.getFullYear();

  const start = new Date(targetYear, targetMonth - 1, 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(targetYear, targetMonth, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
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
        lte: bounds.end,
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
