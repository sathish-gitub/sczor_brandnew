import { createHmac } from "node:crypto";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateSubscriptionEnd } from "@/lib/subscription";

const bodySchema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
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
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = parsed.data;

  const existing = await prisma.payment.findFirst({
    where: { razorpayPaymentId: razorpay_payment_id, tenantId: session.user.tenantId },
  });

  if (existing?.status === "SUCCESS") {
    return NextResponse.json({ success: true, alreadyProcessed: true });
  }

  const settings = await prisma.appSettings.findFirst();
  if (!settings?.razorpayKeySecret) {
    return NextResponse.json({ error: "Razorpay not configured" }, { status: 500 });
  }

  const expectedSignature = createHmac("sha256", settings.razorpayKeySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    await prisma.payment.updateMany({
      where: { razorpayOrderId: razorpay_order_id, tenantId: session.user.tenantId },
      data: { status: "FAILED" },
    });
    return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
  }

  const now = new Date();
  const periodEnd = calculateSubscriptionEnd(plan, now);

  await prisma.payment.updateMany({
    where: { razorpayOrderId: razorpay_order_id, tenantId: session.user.tenantId },
    data: {
      status: "SUCCESS",
      razorpayPaymentId: razorpay_payment_id,
      periodStart: now,
      periodEnd,
    },
  });

  await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data: {
      plan,
      isSubscribed: true,
      subscriptionStart: now,
      subscriptionEnd: periodEnd,
    },
  });

  return NextResponse.json({ success: true });
}

