import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            mobile: true,
            loyaltyCard: {
              select: {
                totalPoints: true,
              },
            },
          },
        },
        items: {
          include: {
            service: {
              select: {
                id: true,
              },
            },
            staff: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        loyaltyTxns: {
          select: {
            id: true,
            type: true,
            points: true,
            description: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: {
        name: true,
        logo: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        phone: true,
        email: true,
        gstNumber: true,
      },
    });

    const loyaltyDiscount = invoice.loyaltyTxns
      .filter((item) => item.type === "REDEEMED")
      .reduce((sum, item) => sum + item.points, 0);

    const pointsEarned = invoice.loyaltyTxns
      .filter((item) => item.type === "EARNED")
      .reduce((sum, item) => sum + item.points, 0);

    return NextResponse.json({
      tenant,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        subtotal: Number(invoice.subtotal),
        discount: Number(invoice.discount),
        loyaltyDiscount,
        taxAmount: Number(invoice.taxAmount),
        total: Number(invoice.total),
        taxRate: Number(invoice.taxRate),
        paymentMethod: invoice.paymentMethod,
        paymentStatus: invoice.paymentStatus,
        customer: {
          id: invoice.customer.id,
          name: invoice.customer.name,
          mobile: invoice.customer.mobile,
          totalPoints: invoice.customer.loyaltyCard?.totalPoints ?? 0,
        },
        items: invoice.items.map((item) => ({
          id: item.id,
          name: item.name,
          price: Number(item.price),
          quantity: item.quantity,
          amount: Number(item.amount),
          serviceId: item.serviceId,
          staffId: item.staffId,
          staffName: item.staff?.name ?? null,
        })),
        pointsEarned,
      },
    });
  } catch (error) {
    console.error("Failed to load invoice", error);
    return NextResponse.json({ error: "Unable to load invoice." }, { status: 500 });
  }
}
