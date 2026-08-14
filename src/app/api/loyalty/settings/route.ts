import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  pointsPerTenRupees: z.number().positive(),
  rupeePerPoint: z.number().positive(),
  minPointsToRedeem: z.number().int().min(0),
  maxRedeemPercent: z.number().min(1).max(100),
  pointsExpiryEnabled: z.boolean(),
  pointsExpiryMonths: z.number().int().min(1).max(120),
  silverThreshold: z.number().int().min(1),
  goldThreshold: z.number().int().min(1),
  platinumThreshold: z.number().int().min(1),
});

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.salonSettings.findUnique({
    where: {
      tenantId: session.user.tenantId,
    },
  });

  return NextResponse.json({
    settings: {
      pointsPerTenRupees: Number(settings?.loyaltyPointsPerRupee ?? 0.1) * 10,
      rupeePerPoint: Number(settings?.rupeePerPoint ?? 1),
      minPointsToRedeem: settings?.minPointsToRedeem ?? 100,
      maxRedeemPercent: Number(settings?.maxRedeemPercent ?? 50),
      pointsExpiryEnabled: settings?.pointsExpiryEnabled ?? false,
      pointsExpiryMonths: settings?.pointsExpiryMonths ?? 12,
      silverThreshold: settings?.silverThreshold ?? 500,
      goldThreshold: settings?.goldThreshold ?? 2000,
      platinumThreshold: settings?.platinumThreshold ?? 5000,
    },
  });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid settings." }, { status: 400 });
    }

    const payload = parsed.data;

    if (!(payload.silverThreshold < payload.goldThreshold && payload.goldThreshold < payload.platinumThreshold)) {
      return NextResponse.json({ error: "Tier thresholds must be ascending." }, { status: 400 });
    }

    await prisma.salonSettings.upsert({
      where: {
        tenantId: session.user.tenantId,
      },
      update: {
        loyaltyPointsPerRupee: payload.pointsPerTenRupees / 10,
        rupeePerPoint: payload.rupeePerPoint,
        minPointsToRedeem: payload.minPointsToRedeem,
        maxRedeemPercent: payload.maxRedeemPercent,
        pointsExpiryEnabled: payload.pointsExpiryEnabled,
        pointsExpiryMonths: payload.pointsExpiryMonths,
        silverThreshold: payload.silverThreshold,
        goldThreshold: payload.goldThreshold,
        platinumThreshold: payload.platinumThreshold,
      },
      create: {
        tenantId: session.user.tenantId,
        loyaltyPointsPerRupee: payload.pointsPerTenRupees / 10,
        rupeePerPoint: payload.rupeePerPoint,
        minPointsToRedeem: payload.minPointsToRedeem,
        maxRedeemPercent: payload.maxRedeemPercent,
        pointsExpiryEnabled: payload.pointsExpiryEnabled,
        pointsExpiryMonths: payload.pointsExpiryMonths,
        silverThreshold: payload.silverThreshold,
        goldThreshold: payload.goldThreshold,
        platinumThreshold: payload.platinumThreshold,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update loyalty settings", error);
    return NextResponse.json({ error: "Unable to update settings." }, { status: 500 });
  }
}
