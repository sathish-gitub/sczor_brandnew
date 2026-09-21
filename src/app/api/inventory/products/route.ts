import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/enforceAccess";
import { prisma } from "@/lib/prisma";

const createProductSchema = z.object({
  name: z.string().trim().min(2, "Product name is required."),
  sku: z.string().optional().or(z.literal("")),
  categoryId: z.string().optional().or(z.literal("")),
  brand: z.string().optional().or(z.literal("")),
  unit: z.string().trim().min(1, "Unit is required.").default("pcs"),
  costPrice: z.coerce.number().min(0, "Cost price must be zero or greater."),
  sellingPrice: z.coerce.number().min(0, "Selling price must be zero or greater."),
  initialStock: z.coerce.number().min(0, "Initial stock must be zero or greater.").default(0),
  reorderLevel: z.coerce.number().min(0, "Reorder level must be zero or greater.").default(0),
  isRetailItem: z.coerce.boolean().default(true),
  supplierId: z.string().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
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

export async function GET(request: Request) {
  const tenantId = await tenantIdOrNull();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const categoryId = url.searchParams.get("categoryId")?.trim();
  const search = url.searchParams.get("search")?.trim();
  const status = url.searchParams.get("status")?.trim();

  try {
    const products = await prisma.product.findMany({
      where: {
        tenantId,
        categoryId: categoryId && categoryId !== "ALL" ? categoryId : undefined,
        status: status === "ACTIVE" || status === "INACTIVE" ? status : undefined,
        name: search ? { contains: search, mode: "insensitive" } : undefined,
      },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ items: products.map(serializeProduct) });
  } catch (error) {
    console.error("Failed to list products", error);
    return NextResponse.json({ error: "Unable to load products." }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

  try {
    const parsed = createProductSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid product data." },
        { status: 400 },
      );
    }

    const payload = parsed.data;

    if (payload.sellingPrice < payload.costPrice) {
      return NextResponse.json(
        { error: "Selling price should not be lower than cost price." },
        { status: 400 },
      );
    }

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          tenantId,
          name: payload.name,
          sku: payload.sku || null,
          categoryId: payload.categoryId || null,
          brand: payload.brand || null,
          unit: payload.unit,
          costPrice: payload.costPrice,
          sellingPrice: payload.sellingPrice,
          currentStock: payload.initialStock,
          reorderLevel: payload.reorderLevel,
          isRetailItem: payload.isRetailItem,
          supplierId: payload.supplierId || null,
          status: payload.status,
        },
      });

      if (payload.initialStock > 0) {
        await tx.stockMovement.create({
          data: {
            tenantId,
            productId: created.id,
            type: "MANUAL_ADJUST_IN",
            quantity: payload.initialStock,
            reason: "Initial stock",
          },
        });
      }

      return tx.product.findFirst({
        where: { id: created.id },
        include: {
          category: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
        },
      });
    });

    return NextResponse.json({ product: product ? serializeProduct(product) : null }, { status: 201 });
  } catch (error) {
    console.error("Failed to create product", error);
    return NextResponse.json({ error: "Unable to create product." }, { status: 500 });
  }
}
