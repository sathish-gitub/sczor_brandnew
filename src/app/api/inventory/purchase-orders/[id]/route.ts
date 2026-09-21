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

  const order = await prisma.purchaseOrder.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      supplier: { select: { id: true, name: true, phone: true, email: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, unit: true, sku: true } },
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Purchase order not found." }, { status: 404 });
  }

  return NextResponse.json({
    purchaseOrder: {
      ...order,
      totalAmount: Number(order.totalAmount),
      items: order.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
        amount: Number(item.amount),
      })),
    },
  });
}
