import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function monthBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [totalMembers, tierCounts, earnedAggregate, redeemedAggregate, activeMembers] = await Promise.all([
      prisma.loyaltyCard.count({
        where: {
          tenantId: session.user.tenantId,
        },
      }),
      prisma.loyaltyCard.groupBy({
        by: ["tier"],
        _count: {
          tier: true,
        },
        where: {
          tenantId: session.user.tenantId,
        },
      }),
      prisma.loyaltyTransaction.aggregate({
        _sum: {
          points: true,
        },
        where: {
          type: "EARNED",
          loyaltyCard: {
            tenantId: session.user.tenantId,
          },
        },
      }),
      prisma.loyaltyTransaction.aggregate({
        _sum: {
          points: true,
        },
        where: {
          type: "REDEEMED",
          loyaltyCard: {
            tenantId: session.user.tenantId,
          },
        },
      }),
      prisma.loyaltyTransaction.findMany({
        where: {
          loyaltyCard: {
            tenantId: session.user.tenantId,
          },
          createdAt: {
            gte: monthBounds().start,
            lte: monthBounds().end,
          },
        },
        select: {
          loyaltyCardId: true,
        },
        distinct: ["loyaltyCardId"],
      }),
    ]);

    const tiers = {
      BRONZE: 0,
      SILVER: 0,
      GOLD: 0,
      PLATINUM: 0,
    };

    for (const row of tierCounts) {
      tiers[row.tier] = row._count.tier;
    }

    return NextResponse.json({
      totalMembers,
      pointsIssued: earnedAggregate._sum.points ?? 0,
      pointsRedeemed: redeemedAggregate._sum.points ?? 0,
      activeMembers: activeMembers.length,
      tiers,
    });
  } catch (error) {
    console.error("Failed to load loyalty stats", error);
    return NextResponse.json({ error: "Unable to load loyalty stats." }, { status: 500 });
  }
}
