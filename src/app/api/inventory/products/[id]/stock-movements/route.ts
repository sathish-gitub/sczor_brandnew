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
    const movements = await prisma.stockMovement.findMany({
      where: { productId: id, tenantId: session.user.tenantId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      items: movements.map((movement) => ({ ...movement, quantity: Number(movement.quantity) })),
    });
  } catch (error) {
    console.error("Failed to load stock movements", error);
    return NextResponse.json({ error: "Unable to load stock movements." }, { status: 500 });
  }
}
