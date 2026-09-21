import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const products = await prisma.product.findMany({
      where: {
        tenantId: session.user.tenantId,
        isRetailItem: true,
        status: "ACTIVE",
        currentStock: { gt: 0 },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        sellingPrice: true,
        currentStock: true,
        category: { select: { name: true } },
      },
    });

    return NextResponse.json({
      items: products.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        unit: product.unit,
        price: Number(product.sellingPrice),
        currentStock: Number(product.currentStock),
        category: product.category?.name ?? null,
      })),
    });
  } catch (error) {
    console.error("Failed to load billing products", error);
    return NextResponse.json({ error: "Unable to load products." }, { status: 500 });
  }
}
