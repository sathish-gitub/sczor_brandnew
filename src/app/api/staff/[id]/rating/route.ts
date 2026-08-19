import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional().or(z.literal("")),
});

async function tenantIdOrNull() {
  const session = await getServerSession(authOptions);
  return session?.user.tenantId ?? null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await tenantIdOrNull();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = ratingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid rating data." },
        { status: 400 },
      );
    }

    const staff = await prisma.staff.findFirst({ where: { id, tenantId }, select: { id: true } });

    if (!staff) {
      return NextResponse.json({ error: "Staff not found." }, { status: 404 });
    }

    await prisma.staffRating.create({
      data: {
        staffId: id,
        tenantId,
        rating: parsed.data.rating,
        comment: parsed.data.comment || null,
      },
    });

    const agg = await prisma.staffRating.aggregate({
      where: { staffId: id },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return NextResponse.json({
      avgRating: Math.round((agg._avg.rating ?? 0) * 10) / 10,
      totalRatings: agg._count.rating,
    });
  } catch (error) {
    console.error("Failed to save staff rating", error);
    return NextResponse.json({ error: "Unable to save rating." }, { status: 500 });
  }
}
