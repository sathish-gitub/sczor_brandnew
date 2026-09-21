import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/enforceAccess";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  const access = await checkWriteAccess(tenantId);
  if (!access.allowed) {
    return NextResponse.json(
      { error: "SUBSCRIPTION_REQUIRED", message: access.reason },
      { status: 403 },
    );
  }

  const { id } = await params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.findFirst({
        where: { id, tenantId },
        include: { items: true },
      });

      if (!order) {
        return { error: "Purchase order not found.", status: 404 as const };
      }

      if (order.status !== "PENDING") {
        return { error: "Only pending purchase orders can be received.", status: 400 as const };
      }

      for (const item of order.items) {
        const quantity = Number(item.quantity);

        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { increment: quantity } },
        });

        await tx.stockMovement.create({
          data: {
            tenantId,
            productId: item.productId,
            type: "PURCHASE_IN",
            quantity,
            reference: order.poNumber,
          },
        });
      }

      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: { status: "RECEIVED", receivedAt: new Date() },
      });

      return { purchaseOrder: updated };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      purchaseOrder: { ...result.purchaseOrder, totalAmount: Number(result.purchaseOrder.totalAmount) },
    });
  } catch (error) {
    console.error("Failed to receive purchase order", error);
    return NextResponse.json({ error: "Unable to mark purchase order as received." }, { status: 500 });
  }
}
