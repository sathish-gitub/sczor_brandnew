import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/enforceAccess";
import { prisma } from "@/lib/prisma";

const lineItemSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.coerce.number().positive("Quantity must be greater than zero."),
  unitCost: z.coerce.number().min(0, "Unit cost must be zero or greater."),
});

const createSchema = z.object({
  supplierId: z.string().cuid("Select a supplier."),
  items: z.array(lineItemSchema).min(1, "Add at least one line item."),
  notes: z.string().optional().or(z.literal("")),
});

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

async function tenantIdOrNull() {
  const session = await getServerSession(authOptions);
  return session?.user.tenantId ?? null;
}

async function nextPoNumber(tenantId: string) {
  const year = new Date().getFullYear();
  const basePrefix = `PO-${year}-`;

  const latest = await prisma.purchaseOrder.findFirst({
    where: { tenantId, poNumber: { startsWith: basePrefix } },
    orderBy: { poNumber: "desc" },
    select: { poNumber: true },
  });

  const lastSequence = latest ? Number(latest.poNumber.split("-").at(-1) ?? "0") : 0;
  const next = Number.isFinite(lastSequence) ? lastSequence + 1 : 1;

  return `${basePrefix}${String(next).padStart(4, "0")}`;
}

export async function GET(request: Request) {
  const tenantId = await tenantIdOrNull();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.trim();

  try {
    const orders = await prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        status: status && status !== "ALL" ? status : undefined,
      },
      include: {
        supplier: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      items: orders.map((order) => ({
        id: order.id,
        poNumber: order.poNumber,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        createdAt: order.createdAt,
        receivedAt: order.receivedAt,
        supplier: order.supplier,
        itemCount: order._count.items,
      })),
    });
  } catch (error) {
    console.error("Failed to list purchase orders", error);
    return NextResponse.json({ error: "Unable to load purchase orders." }, { status: 500 });
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
    const parsed = createSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid purchase order data." },
        { status: 400 },
      );
    }

    const payload = parsed.data;

    const supplier = await prisma.supplier.findFirst({
      where: { id: payload.supplierId, tenantId },
      select: { id: true },
    });

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found." }, { status: 404 });
    }

    const productIds = [...new Set(payload.items.map((item) => item.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId },
      select: { id: true },
    });

    const productSet = new Set(products.map((product) => product.id));

    if (productSet.size !== productIds.length) {
      return NextResponse.json({ error: "One or more products are invalid." }, { status: 400 });
    }

    const normalizedItems = payload.items.map((item) => {
      const amount = roundMoney(item.quantity * item.unitCost);
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        amount,
      };
    });

    const totalAmount = roundMoney(normalizedItems.reduce((sum, item) => sum + item.amount, 0));
    const poNumber = await nextPoNumber(tenantId);

    const order = await prisma.purchaseOrder.create({
      data: {
        tenantId,
        supplierId: payload.supplierId,
        poNumber,
        status: "PENDING",
        totalAmount,
        notes: payload.notes || null,
        items: {
          create: normalizedItems,
        },
      },
      include: {
        supplier: { select: { id: true, name: true } },
        items: true,
      },
    });

    return NextResponse.json({ purchaseOrder: { ...order, totalAmount: Number(order.totalAmount) } }, { status: 201 });
  } catch (error) {
    console.error("Failed to create purchase order", error);
    return NextResponse.json({ error: "Unable to create purchase order." }, { status: 500 });
  }
}
