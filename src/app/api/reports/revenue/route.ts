import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parseDate(value: string | null, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }

  return date;
}

function monthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function dayKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const startDate = parseDate(url.searchParams.get("startDate"));
  const endDate = parseDate(url.searchParams.get("endDate"), true);
  const staffId = url.searchParams.get("staffId")?.trim() || undefined;
  const paymentMethod = url.searchParams.get("paymentMethod")?.trim() || undefined;

  const fallback = monthBounds();
  const from = startDate ?? fallback.start;
  const to = endDate ?? fallback.end;

  try {
    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId: session.user.tenantId,
        paymentStatus: "PAID",
        invoiceDate: {
          gte: from,
          lte: to,
        },
        paymentMethod: paymentMethod && paymentMethod !== "ALL" ? (paymentMethod as "CASH" | "UPI" | "CARD" | "WALLET") : undefined,
        appointment: staffId
          ? {
              staffId,
            }
          : undefined,
      },
      include: {
        items: true,
        loyaltyTxns: {
          where: {
            type: "REDEEMED",
          },
          select: {
            points: true,
          },
        },
      },
      orderBy: {
        invoiceDate: "asc",
      },
    });

    const paymentBuckets: Record<string, { amount: number; count: number }> = {
      CASH: { amount: 0, count: 0 },
      UPI: { amount: 0, count: 0 },
      CARD: { amount: 0, count: 0 },
      WALLET: { amount: 0, count: 0 },
    };

    const serviceBuckets = new Map<string, { count: number; revenue: number }>();
    const dailyBuckets = new Map<string, {
      revenue: number;
      gst: number;
      discount: number;
      loyaltyDiscount: number;
      invoices: number;
    }>();

    let grossRevenue = 0;
    let gstCollected = 0;
    let discountsGiven = 0;
    let loyaltyDiscounts = 0;

    for (const invoice of invoices) {
      const total = Number(invoice.total);
      const tax = Number(invoice.taxAmount);
      const discount = Number(invoice.discount);
      const loyaltyDiscount = invoice.loyaltyTxns.reduce((sum, item) => sum + item.points, 0);

      grossRevenue += total;
      gstCollected += tax;
      discountsGiven += discount;
      loyaltyDiscounts += loyaltyDiscount;

      paymentBuckets[invoice.paymentMethod].amount += total;
      paymentBuckets[invoice.paymentMethod].count += 1;

      const key = dayKey(invoice.invoiceDate);
      const day = dailyBuckets.get(key) ?? {
        revenue: 0,
        gst: 0,
        discount: 0,
        loyaltyDiscount: 0,
        invoices: 0,
      };
      day.revenue += total;
      day.gst += tax;
      day.discount += discount;
      day.loyaltyDiscount += loyaltyDiscount;
      day.invoices += 1;
      dailyBuckets.set(key, day);

      for (const item of invoice.items) {
        const bucket = serviceBuckets.get(item.name) ?? { count: 0, revenue: 0 };
        bucket.count += item.quantity;
        bucket.revenue += Number(item.amount);
        serviceBuckets.set(item.name, bucket);
      }
    }

    const daily = [...dailyBuckets.entries()].map(([date, value]) => ({
      date,
      revenue: Math.round(value.revenue * 100) / 100,
      gst: Math.round(value.gst * 100) / 100,
      discount: Math.round(value.discount * 100) / 100,
      loyaltyDiscount: Math.round(value.loyaltyDiscount * 100) / 100,
      net: Math.round((value.revenue - value.gst) * 100) / 100,
      invoices: value.invoices,
    }));

    const services = [...serviceBuckets.entries()]
      .map(([name, value]) => ({
        service: name,
        count: value.count,
        revenue: Math.round(value.revenue * 100) / 100,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({
      totals: {
        grossRevenue: Math.round(grossRevenue * 100) / 100,
        gstCollected: Math.round(gstCollected * 100) / 100,
        discountsGiven: Math.round(discountsGiven * 100) / 100,
        loyaltyDiscounts: Math.round(loyaltyDiscounts * 100) / 100,
        netRevenue: Math.round((grossRevenue - gstCollected) * 100) / 100,
      },
      byPaymentMethod: Object.entries(paymentBuckets).map(([method, value]) => ({
        method,
        amount: Math.round(value.amount * 100) / 100,
        count: value.count,
      })),
      daily,
      byService: services,
    });
  } catch (error) {
    console.error("Failed to load revenue report", error);
    return NextResponse.json({ error: "Unable to load revenue report." }, { status: 500 });
  }
}
