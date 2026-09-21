import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "10") || 10;

  try {
    const products = await prisma.product.findMany({
      where: {
        tenantId: session.user.tenantId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        unit: true,
        currentStock: true,
        reorderLevel: true,
        category: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });

    const lowStock = products
      .map((product) => ({
        id: product.id,
        name: product.name,
        unit: product.unit,
        currentStock: Number(product.currentStock),
        reorderLevel: Number(product.reorderLevel),
        category: product.category?.name ?? null,
        supplier: product.supplier?.name ?? null,
      }))
      .filter((product) => product.currentStock <= product.reorderLevel)
      .sort((a, b) => (b.reorderLevel - b.currentStock) - (a.reorderLevel - a.currentStock));

    return NextResponse.json({
      items: lowStock.slice(0, limit),
      totalCount: lowStock.length,
    });
  } catch (error) {
    console.error("Failed to load low stock products", error);
    return NextResponse.json({ error: "Unable to load low stock products." }, { status: 500 });
  }
}
