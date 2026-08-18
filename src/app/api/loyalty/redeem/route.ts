import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateLoyaltyTier } from "@/lib/utils";

const schema = z.object({
  customerId: z.string().cuid(),
  points: z.number().int().positive(),
  reason: z.string().trim().min(2).optional(),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
    }

    const payload = parsed.data;

    const card = await prisma.loyaltyCard.findFirst({
      where: {
        customerId: payload.customerId,
        tenantId: session.user.tenantId,
      },
      select: {
        id: true,
        totalPoints: true,
      },
    });

    if (!card) {
      return NextResponse.json({ error: "Loyalty card not found." }, { status: 404 });
    }

    if (payload.points > card.totalPoints) {
      return NextResponse.json({ error: "Insufficient points." }, { status: 400 });
    }

    const settings = await prisma.salonSettings.findUnique({
      where: { tenantId: session.user.tenantId },
      select: { silverThreshold: true, goldThreshold: true, platinumThreshold: true },
    });

    const result = await prisma.$transaction(async (tx) => {
      await tx.loyaltyTransaction.create({
        data: {
          loyaltyCardId: card.id,
          points: payload.points,
          type: "REDEEMED",
          description: payload.reason || "Manual redemption",
        },
      });

      const updated = await tx.loyaltyCard.update({
        where: {
          id: card.id,
        },
        data: {
          totalPoints: {
            decrement: payload.points,
          },
          pointsRedeemed: {
            increment: payload.points,
          },
          tier: calculateLoyaltyTier(card.totalPoints - payload.points, {
            silverThreshold: settings?.silverThreshold ?? 500,
            goldThreshold: settings?.goldThreshold ?? 2000,
            platinumThreshold: settings?.platinumThreshold ?? 5000,
          }),
        },
        select: {
          totalPoints: true,
        },
      });

      return updated;
    });

    return NextResponse.json({
      success: true,
      remainingPoints: result.totalPoints,
      redeemedPoints: payload.points,
    });
  } catch (error) {
    console.error("Failed to redeem points", error);
    return NextResponse.json({ error: "Unable to redeem points." }, { status: 500 });
  }
}
