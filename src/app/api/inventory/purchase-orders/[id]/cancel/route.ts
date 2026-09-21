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
    const order = await prisma.purchaseOrder.findFirst({ where: { id, tenantId }, select: { status: true } });

    if (!order) {
      return NextResponse.json({ error: "Purchase order not found." }, { status: 404 });
    }

    if (order.status !== "PENDING") {
      return NextResponse.json({ error: "Only pending purchase orders can be cancelled." }, { status: 400 });
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({ purchaseOrder: { ...updated, totalAmount: Number(updated.totalAmount) } });
  } catch (error) {
    console.error("Failed to cancel purchase order", error);
    return NextResponse.json({ error: "Unable to cancel purchase order." }, { status: 500 });
  }
}
