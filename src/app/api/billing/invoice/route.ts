import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/enforceAccess";
import { prisma } from "@/lib/prisma";
import { calculateLoyaltyTier } from "@/lib/utils";

const itemSchema = z
  .object({
    type: z.enum(["SERVICE", "PRODUCT"]).default("SERVICE"),
    serviceId: z.string().cuid().optional(),
    productId: z.string().cuid().optional(),
    quantity: z.number().int().min(1).max(50),
    staffId: z.string().cuid().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "SERVICE" && !data.serviceId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "serviceId is required for SERVICE items." });
    }

    if (data.type === "PRODUCT" && !data.productId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "productId is required for PRODUCT items." });
    }
  });

const payloadSchema = z.object({
  customerId: z.string().cuid(),
  appointmentId: z.string().cuid().optional(),
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

  const access = await checkWriteAccess(session.user.tenantId);
  if (!access.allowed) {
    return NextResponse.json(
      { error: "SUBSCRIPTION_REQUIRED", message: access.reason },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const parsed = payloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid billing payload." }, { status: 400 });
    }

    const payload = parsed.data;

    const serviceItems = payload.items.filter((item) => item.type === "SERVICE");
    const productItems = payload.items.filter((item) => item.type === "PRODUCT");

    const [settings, customer, services, products] = await Promise.all([
      prisma.salonSettings.findUnique({
        where: {
          tenantId: session.user.tenantId,
        },
        select: {
          invoicePrefix: true,
          gstEnabled: true,
          gstRate: true,
          silverThreshold: true,
          goldThreshold: true,
          platinumThreshold: true,
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
            in: serviceItems.map((item) => item.serviceId!),
          },
        },
        select: {
          id: true,
          name: true,
          price: true,
        },
      }),
      prisma.product.findMany({
        where: {
          tenantId: session.user.tenantId,
          status: "ACTIVE",
          id: {
            in: productItems.map((item) => item.productId!),
          },
        },
        select: {
          id: true,
          name: true,
          sellingPrice: true,
          currentStock: true,
        },
      }),
    ]);

    if (!customer) {
      return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    }

    const serviceMap = new Map(services.map((item) => [item.id, item]));

    if (serviceMap.size !== serviceItems.length) {
      return NextResponse.json({ error: "One or more services are unavailable." }, { status: 400 });
    }

    const productMap = new Map(products.map((item) => [item.id, item]));

    if (productMap.size !== new Set(productItems.map((item) => item.productId)).size) {
      return NextResponse.json({ error: "One or more products are unavailable." }, { status: 400 });
    }

    const requestedStaffIds = [
      ...new Set(serviceItems.map((item) => item.staffId).filter((value): value is string => Boolean(value))),
    ];

    const validStaff = requestedStaffIds.length
      ? await prisma.staff.findMany({
          where: { tenantId: session.user.tenantId, id: { in: requestedStaffIds } },
          select: { id: true },
        })
      : [];

    const validStaffIds = new Set(validStaff.map((member) => member.id));

    if (requestedStaffIds.some((id) => !validStaffIds.has(id))) {
      return NextResponse.json({ error: "One or more staff members are invalid." }, { status: 400 });
    }

    const normalizedItems = payload.items.map((item) => {
      if (item.type === "PRODUCT") {
        const product = productMap.get(item.productId!)!;
        const unitPrice = Number(product.sellingPrice);
        const amount = roundMoney(unitPrice * item.quantity);

        return {
          type: "PRODUCT" as const,
          productId: item.productId!,
          serviceId: null,
          staffId: null,
          name: product.name,
          quantity: item.quantity,
          unitPrice,
          amount,
        };
      }

      const service = serviceMap.get(item.serviceId!)!;
      const unitPrice = Number(service.price);
      const amount = roundMoney(unitPrice * item.quantity);

      return {
        type: "SERVICE" as const,
        serviceId: item.serviceId!,
        productId: null,
        staffId: item.staffId && validStaffIds.has(item.staffId) ? item.staffId : null,
        name: service.name,
        quantity: item.quantity,
        unitPrice,
        amount,
      };
    });

    const requestedProductQuantities = new Map<string, number>();
    for (const item of normalizedItems) {
      if (item.type === "PRODUCT") {
        requestedProductQuantities.set(item.productId, (requestedProductQuantities.get(item.productId) ?? 0) + item.quantity);
      }
    }

    for (const [productId, quantity] of requestedProductQuantities) {
      const product = productMap.get(productId)!;
      const availableStock = Number(product.currentStock);

      if (quantity > availableStock) {
        return NextResponse.json(
          { error: `Insufficient stock for ${product.name}: requested ${quantity}, available ${availableStock}.` },
          { status: 400 },
        );
      }
    }

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
    const gstEnabled = settings?.gstEnabled ?? true;
    const gstRate = Number(settings?.gstRate ?? 18);
    const taxAmount = gstEnabled ? roundMoney((taxableAmount * gstRate) / 100) : 0;
    const total = roundMoney(taxableAmount + taxAmount);

    const pointsEarned = Math.floor(total / 10);

    const invoicePrefix = settings?.invoicePrefix ?? "INV";
    const invoiceNumber = await nextInvoiceNumber(session.user.tenantId, invoicePrefix);

    const linkedAppointment = payload.appointmentId
      ? await prisma.appointment.findFirst({
          where: { id: payload.appointmentId, tenantId: session.user.tenantId, invoice: null },
          select: { id: true },
        })
      : null;

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
          appointmentId: linkedAppointment?.id ?? null,
          staffId: normalizedItems.find((item) => item.staffId)?.staffId ?? null,
          items: {
            create: normalizedItems.map((item) => ({
              name: item.name,
              price: item.unitPrice,
              quantity: item.quantity,
              amount: item.amount,
              serviceId: item.serviceId,
              productId: item.productId,
              staffId: item.staffId,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      for (const item of normalizedItems) {
        if (item.type !== "PRODUCT") {
          continue;
        }

        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { decrement: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            tenantId: session.user.tenantId,
            productId: item.productId,
            type: "SALE_OUT",
            quantity: item.quantity,
            reference: invoice.invoiceNumber,
          },
        });
      }

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
          tier: calculateLoyaltyTier(totalPointsAfter, {
            silverThreshold: settings?.silverThreshold ?? 500,
            goldThreshold: settings?.goldThreshold ?? 2000,
            platinumThreshold: settings?.platinumThreshold ?? 5000,
          }),
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

    if (linkedAppointment) {
      await prisma.appointment.update({
        where: { id: linkedAppointment.id },
        data: { status: "BILLED" },
      });
    }

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
