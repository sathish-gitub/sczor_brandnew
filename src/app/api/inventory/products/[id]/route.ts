import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/enforceAccess";
import { prisma } from "@/lib/prisma";

const updateProductSchema = z.object({
  name: z.string().trim().min(2, "Product name is required.").optional(),
  sku: z.string().optional().or(z.literal("")),
  categoryId: z.string().optional().or(z.literal("")),
  brand: z.string().optional().or(z.literal("")),
  unit: z.string().trim().min(1, "Unit is required.").optional(),
  costPrice: z.coerce.number().min(0).optional(),
  sellingPrice: z.coerce.number().min(0).optional(),
  reorderLevel: z.coerce.number().min(0).optional(),
  isRetailItem: z.coerce.boolean().optional(),
  supplierId: z.string().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

function serializeProduct(product: {
  costPrice: unknown;
  sellingPrice: unknown;
  currentStock: unknown;
  reorderLevel: unknown;
  [key: string]: unknown;
}) {
  return {
    ...product,
    costPrice: Number(product.costPrice),
    sellingPrice: Number(product.sellingPrice),
    currentStock: Number(product.currentStock),
    reorderLevel: Number(product.reorderLevel),
  };
}

async function tenantIdOrNull() {
  const session = await getServerSession(authOptions);
  return session?.user.tenantId ?? null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await tenantIdOrNull();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const product = await prisma.product.findFirst({
    where: { id, tenantId },
    include: {
      category: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  return NextResponse.json({ product: serializeProduct(product) });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await tenantIdOrNull();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await checkWriteAccess(tenantId);
  if (!access.allowed) {
    return NextResponse.json(
      { error: "SUBSCRIPTION_REQUIRED", message: access.reason },
      { status: 403 },
    );
  }

  const { id } = await params;

  try {
    const parsed = updateProductSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid product data." },
        { status: 400 },
      );
    }

    const payload = parsed.data;

    // currentStock is intentionally excluded — it is only changed via stock movements.
    const updated = await prisma.product.updateMany({
      where: { id, tenantId },
      data: {
        name: payload.name,
        sku: payload.sku === "" ? null : payload.sku,
        categoryId: payload.categoryId === "" ? null : payload.categoryId,
        brand: payload.brand === "" ? null : payload.brand,
        unit: payload.unit,
        costPrice: payload.costPrice,
        sellingPrice: payload.sellingPrice,
        reorderLevel: payload.reorderLevel,
        isRetailItem: payload.isRetailItem,
        supplierId: payload.supplierId === "" ? null : payload.supplierId,
        status: payload.status,
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const product = await prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ product: product ? serializeProduct(product) : null });
  } catch (error) {
    console.error("Failed to update product", error);
    return NextResponse.json({ error: "Unable to update product." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await tenantIdOrNull();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const product = await prisma.product.findFirst({ where: { id, tenantId }, select: { id: true } });

    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const movementCount = await prisma.stockMovement.count({ where: { productId: id, tenantId } });

    if (movementCount > 0) {
      await prisma.product.update({ where: { id }, data: { status: "INACTIVE" } });
      return NextResponse.json({ softDeleted: true, message: "Product has stock history; marked inactive instead of deleted." });
    }

    await prisma.product.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete product", error);
    return NextResponse.json({ error: "Unable to delete product." }, { status: 500 });
  }
}
