import { createHmac } from "node:crypto";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { calculateGSTBreakdown } from "@/lib/gst";
import { prisma } from "@/lib/prisma";
import { calculateSubscriptionEnd } from "@/lib/subscription";
import { sendSubscriptionInvoiceEmail } from "@/lib/subscriptionInvoiceEmail";

const bodySchema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
  plan: z.enum(["MONTHLY", "YEARLY"]),
});

async function nextSubscriptionInvoiceNumber(tenantId: string) {
  const year = new Date().getFullYear();
  const basePrefix = `SUB-INV-${year}-`;

  const latest = await prisma.payment.findFirst({
    where: {
      tenantId,
      invoiceNumber: {
        startsWith: basePrefix,
      },
    },
    orderBy: {
      invoiceNumber: "desc",
    },
    select: {
      invoiceNumber: true,
    },
  });

  const lastSequence = latest?.invoiceNumber ? Number(latest.invoiceNumber.split("-").at(-1) ?? "0") : 0;
  const next = Number.isFinite(lastSequence) ? lastSequence + 1 : 1;

  return `${basePrefix}${String(next).padStart(4, "0")}`;
}

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

  const paymentRecord = await prisma.payment.findFirst({
    where: { razorpayOrderId: razorpay_order_id, tenantId: session.user.tenantId },
  });

  const invoiceNumber = paymentRecord ? await nextSubscriptionInvoiceNumber(session.user.tenantId) : null;
  const gstBreakdown = paymentRecord ? calculateGSTBreakdown(paymentRecord.amount) : null;

  await prisma.payment.updateMany({
    where: { razorpayOrderId: razorpay_order_id, tenantId: session.user.tenantId },
    data: {
      status: "SUCCESS",
      razorpayPaymentId: razorpay_payment_id,
      periodStart: now,
      periodEnd,
      ...(invoiceNumber ? { invoiceNumber } : {}),
      ...(gstBreakdown
        ? { baseAmount: gstBreakdown.baseAmount, gstAmount: gstBreakdown.gstAmount, gstRate: gstBreakdown.gstRate }
        : {}),
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

  if (paymentRecord) {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: session.user.tenantId },
        select: { name: true, email: true },
      });

      if (tenant) {
        await sendSubscriptionInvoiceEmail(
          {
            invoiceNumber,
            baseAmount: gstBreakdown?.baseAmount ?? null,
            gstAmount: gstBreakdown?.gstAmount ?? null,
            gstRate: gstBreakdown?.gstRate ?? null,
            amount: paymentRecord.amount,
            plan,
            periodStart: now,
            periodEnd,
            razorpayPaymentId: razorpay_payment_id,
            createdAt: paymentRecord.createdAt,
          },
          tenant,
        );

        await prisma.payment.updateMany({
          where: { razorpayOrderId: razorpay_order_id, tenantId: session.user.tenantId },
          data: { invoiceEmailSentAt: new Date() },
        });
      }
    } catch (emailError) {
      console.error("Failed to send subscription invoice email", emailError);
    }
  }

  return NextResponse.json({ success: true });
}

