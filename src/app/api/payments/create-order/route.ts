import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PRICING_PLANS } from "@/lib/pricing";
import { getRazorpayInstance } from "@/lib/razorpay";

const PLAN_AMOUNTS = {
  MONTHLY: PRICING_PLANS.MONTHLY.price * 100,
  YEARLY: PRICING_PLANS.YEARLY.price * 100,
} as const;

const bodySchema = z.object({
  plan: z.enum(["MONTHLY", "YEARLY"]),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.tenantId || session.user.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  try {
    const razorpay = await getRazorpayInstance();
    const settings = await prisma.appSettings.findFirst();
    const amount = PLAN_AMOUNTS[parsed.data.plan];

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      notes: {
        tenantId: session.user.tenantId,
        plan: parsed.data.plan,
      },
    });

    await prisma.payment.create({
      data: {
        tenantId: session.user.tenantId,
        plan: parsed.data.plan,
        amount: amount / 100,
        razorpayOrderId: order.id,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount,
      currency: "INR",
      keyId: settings?.razorpayKeyId ?? undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create order" },
      { status: 500 },
    );
  }
}
