import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function tierMin(tier: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM", settings: {
  silverThreshold: number;
  goldThreshold: number;
  platinumThreshold: number;
}) {
  if (tier === "SILVER") {
    return settings.silverThreshold;
  }

  if (tier === "GOLD") {
    return settings.goldThreshold;
  }

  if (tier === "PLATINUM") {
    return settings.platinumThreshold;
  }

  return 0;
}

export async function GET(_request: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { customerId } = await params;

  try {
    const [settings, customer] = await Promise.all([
      prisma.salonSettings.findUnique({
        where: {
          tenantId: session.user.tenantId,
        },
        select: {
          silverThreshold: true,
          goldThreshold: true,
          platinumThreshold: true,
        },
      }),
      prisma.customer.findFirst({
        where: {
          id: customerId,
          tenantId: session.user.tenantId,
        },
        include: {
          loyaltyCard: {
            include: {
              transactions: {
                orderBy: {
                  createdAt: "desc",
                },
                include: {
                  invoice: {
                    select: {
                      invoiceNumber: true,
                    },
                  },
                },
                take: 200,
              },
            },
          },
        },
      }),
    ]);

    if (!customer || !customer.loyaltyCard) {
      return NextResponse.json({ error: "Loyalty card not found." }, { status: 404 });
    }

    const loyalty = customer.loyaltyCard;

    const thresholds = {
      silver: settings?.silverThreshold ?? 500,
      gold: settings?.goldThreshold ?? 2000,
      platinum: settings?.platinumThreshold ?? 5000,
    };

    const nextTierTarget =
      loyalty.tier === "BRONZE"
        ? thresholds.silver
        : loyalty.tier === "SILVER"
          ? thresholds.gold
          : loyalty.tier === "GOLD"
            ? thresholds.platinum
            : thresholds.platinum;

    const currentTierFloor = tierMin(loyalty.tier, {
      silverThreshold: thresholds.silver,
      goldThreshold: thresholds.gold,
      platinumThreshold: thresholds.platinum,
    });

    const currentPoints = loyalty.totalPoints;
    const nextTierGap = Math.max(0, nextTierTarget - currentPoints);
    const progressPercent =
      loyalty.tier === "PLATINUM"
        ? 100
        : Math.min(
            100,
            Math.round(((currentPoints - currentTierFloor) / Math.max(1, nextTierTarget - currentTierFloor)) * 100),
          );

    let runningBalance = currentPoints;
    const history = loyalty.transactions
      .slice()
      .reverse()
      .map((txn) => {
        const delta = txn.type === "EARNED" ? txn.points : -txn.points;
        runningBalance -= delta;
        return {
          id: txn.id,
          date: txn.createdAt,
          type: txn.type,
          points: txn.points,
          description: txn.description,
          invoiceNumber: txn.invoice?.invoiceNumber ?? null,
          balanceAfter: runningBalance + delta,
        };
      })
      .reverse();

    const earned = loyalty.transactions
      .filter((item) => item.type === "EARNED")
      .reduce((sum, item) => sum + item.points, 0);

    const redeemed = loyalty.transactions
      .filter((item) => item.type === "REDEEMED")
      .reduce((sum, item) => sum + item.points, 0);

    return NextResponse.json({
      card: {
        customerId: customer.id,
        name: customer.name,
        mobile: customer.mobile,
        tier: loyalty.tier,
        points: loyalty.totalPoints,
        totalSpent: Number(loyalty.totalSpent),
        memberSince: loyalty.createdAt,
        totalEarned: earned,
        totalRedeemed: redeemed,
        nextTierTarget,
        nextTierGap,
        progressPercent,
      },
      history,
    });
  } catch (error) {
    console.error("Failed to load loyalty card", error);
    return NextResponse.json({ error: "Unable to load loyalty card." }, { status: 500 });
  }
}
