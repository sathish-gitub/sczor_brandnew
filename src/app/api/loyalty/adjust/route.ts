import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateLoyaltyTier } from "@/lib/utils";

const schema = z.object({
  customerId: z.string().cuid(),
  points: z.number().int().min(1),
  mode: z.enum(["ADD", "DEDUCT"]),
  reason: z.string().trim().min(2, "Reason is required."),
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

    if (payload.mode === "DEDUCT" && payload.points > card.totalPoints) {
      return NextResponse.json({ error: "Cannot deduct more than available points." }, { status: 400 });
    }

    const nextPoints =
      payload.mode === "ADD" ? card.totalPoints + payload.points : card.totalPoints - payload.points;

    const settings = await prisma.salonSettings.findUnique({
      where: { tenantId: session.user.tenantId },
      select: { silverThreshold: true, goldThreshold: true, platinumThreshold: true },
    });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.loyaltyTransaction.create({
        data: {
          loyaltyCardId: card.id,
          type: payload.mode === "ADD" ? "EARNED" : "REDEEMED",
          points: payload.points,
          description: payload.reason,
        },
      });

      return tx.loyaltyCard.update({
        where: {
          id: card.id,
        },
        data: {
          totalPoints:
            payload.mode === "ADD"
              ? {
                  increment: payload.points,
                }
              : {
                  decrement: payload.points,
                },
          pointsRedeemed:
            payload.mode === "DEDUCT"
              ? {
                  increment: payload.points,
                }
              : undefined,
          tier: calculateLoyaltyTier(nextPoints, {
            silverThreshold: settings?.silverThreshold ?? 500,
            goldThreshold: settings?.goldThreshold ?? 2000,
            platinumThreshold: settings?.platinumThreshold ?? 5000,
          }),
        },
        select: {
          totalPoints: true,
        },
      });
    });

    return NextResponse.json({
      success: true,
      totalPoints: updated.totalPoints,
    });
  } catch (error) {
    console.error("Failed to adjust points", error);
    return NextResponse.json({ error: "Unable to adjust points." }, { status: 500 });
  }
}
