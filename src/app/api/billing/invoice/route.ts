import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const itemSchema = z.object({
  serviceId: z.string().cuid(),
  quantity: z.number().int().min(1).max(50),
});

const payloadSchema = z.object({
  customerId: z.string().cuid(),
  paymentMethod: z.enum(["CASH", "UPI", "CARD"]),
  items: z.array(itemSchema).min(1, "At least one item is required."),
  discountType: z.enum(["PERCENT", "FLAT"]).default("FLAT"),
  discountValue: z.number().min(0).default(0),
  useLoyaltyPoints: z.boolean().default(false),
  loyaltyPointsToRedeem: z.number().int().min(0).default(0),
});

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

async function nextInvoiceNumber(tenantId: string, prefix: string) {
  const year = new Date().getFullYear();
  const basePrefix = `${prefix}-${year}-`;

  const latest = await prisma.invoice.findFirst({
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

  const lastSequence = latest ? Number(latest.invoiceNumber.split("-").at(-1) ?? "0") : 0;
  const next = Number.isFinite(lastSequence) ? lastSequence + 1 : 1;

  return `${basePrefix}${String(next).padStart(4, "0")}`;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = payloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid billing payload." }, { status: 400 });
    }

    const payload = parsed.data;

    const [settings, customer, services] = await Promise.all([
      prisma.salonSettings.findUnique({
        where: {
          tenantId: session.user.tenantId,
        },
        select: {
          invoicePrefix: true,
          gstRate: true,
        },
      }),
      prisma.customer.findFirst({
        where: {
          id: payload.customerId,
          tenantId: session.user.tenantId,
        },
        select: {
          id: true,
          name: true,
          loyaltyCard: {
            select: {
              id: true,
              totalPoints: true,
              pointsRedeemed: true,
              totalSpent: true,
            },
          },
        },
      }),
      prisma.service.findMany({
        where: {
          tenantId: session.user.tenantId,
          status: "ACTIVE",
          id: {
            in: payload.items.map((item) => item.serviceId),
          },
        },
        select: {
          id: true,
          name: true,
          price: true,
        },
      }),
    ]);

    if (!customer) {
      return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    }

    const serviceMap = new Map(services.map((item) => [item.id, item]));

    if (serviceMap.size !== payload.items.length) {
      return NextResponse.json({ error: "One or more services are unavailable." }, { status: 400 });
    }

    const normalizedItems = payload.items.map((item) => {
      const service = serviceMap.get(item.serviceId)!;
      const unitPrice = Number(service.price);
      const amount = roundMoney(unitPrice * item.quantity);

      return {
        serviceId: item.serviceId,
        name: service.name,
        quantity: item.quantity,
        unitPrice,
        amount,
      };
    });

    const subtotal = roundMoney(normalizedItems.reduce((sum, item) => sum + item.amount, 0));

    const maxManualDiscount = subtotal;
    const manualDiscount =
      payload.discountType === "PERCENT"
        ? roundMoney(clamp((subtotal * payload.discountValue) / 100, 0, maxManualDiscount))
        : roundMoney(clamp(payload.discountValue, 0, maxManualDiscount));

    const amountAfterManualDiscount = roundMoney(subtotal - manualDiscount);

    const availablePoints = customer.loyaltyCard?.totalPoints ?? 0;
    const requestedPoints = payload.useLoyaltyPoints ? payload.loyaltyPointsToRedeem : 0;
    const loyaltyDiscount = roundMoney(
      clamp(requestedPoints, 0, Math.min(availablePoints, Math.floor(amountAfterManualDiscount))),
    );

    const taxableAmount = roundMoney(Math.max(0, amountAfterManualDiscount - loyaltyDiscount));
    const gstRate = Number(settings?.gstRate ?? 18);
    const taxAmount = roundMoney((taxableAmount * gstRate) / 100);
    const total = roundMoney(taxableAmount + taxAmount);

    const pointsEarned = Math.floor(total / 10);

    const invoicePrefix = settings?.invoicePrefix ?? "INV";
    const invoiceNumber = await nextInvoiceNumber(session.user.tenantId, invoicePrefix);

    const created = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          tenantId: session.user.tenantId,
          customerId: customer.id,
          invoiceNumber,
          subtotal,
          taxRate: gstRate,
          taxAmount,
          discount: manualDiscount,
          total,
          paymentMethod: payload.paymentMethod,
          paymentStatus: "PAID",
          items: {
            create: normalizedItems.map((item) => ({
              name: item.name,
              price: item.unitPrice,
              quantity: item.quantity,
              amount: item.amount,
              serviceId: item.serviceId,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      let totalPointsAfter = availablePoints;

      const card =
        customer.loyaltyCard ??
        (await tx.loyaltyCard.create({
          data: {
            tenantId: session.user.tenantId,
            customerId: customer.id,
          },
        }));

      if (loyaltyDiscount > 0) {
        await tx.loyaltyTransaction.create({
          data: {
            loyaltyCardId: card.id,
            invoiceId: invoice.id,
            points: loyaltyDiscount,
            type: "REDEEMED",
            description: `Redeemed during invoice ${invoice.invoiceNumber}`,
          },
        });

        totalPointsAfter -= loyaltyDiscount;
      }

      if (pointsEarned > 0) {
        await tx.loyaltyTransaction.create({
          data: {
            loyaltyCardId: card.id,
            invoiceId: invoice.id,
            points: pointsEarned,
            type: "EARNED",
            description: `Earned from invoice ${invoice.invoiceNumber}`,
          },
        });

        totalPointsAfter += pointsEarned;
      }

      await tx.loyaltyCard.update({
        where: {
          id: card.id,
        },
        data: {
          totalPoints: totalPointsAfter,
          pointsRedeemed: {
            increment: loyaltyDiscount,
          },
          totalSpent: {
            increment: total,
          },
        },
      });

      return {
        invoice,
        loyaltyDiscount,
        pointsEarned,
        totalPointsAfter,
      };
    });

    return NextResponse.json({
      success: true,
      invoiceId: created.invoice.id,
      invoiceNumber: created.invoice.invoiceNumber,
      customerName: customer.name,
      total: Number(created.invoice.total),
      subtotal: Number(created.invoice.subtotal),
      discount: Number(created.invoice.discount),
      loyaltyDiscount: created.loyaltyDiscount,
      gst: Number(created.invoice.taxAmount),
      pointsEarned: created.pointsEarned,
      totalPoints: created.totalPointsAfter,
    });
  } catch (error) {
    console.error("Failed to create invoice", error);
    return NextResponse.json({ error: "Unable to complete payment." }, { status: 500 });
  }
}
