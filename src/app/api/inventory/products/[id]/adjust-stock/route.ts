import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/enforceAccess";
import { prisma } from "@/lib/prisma";

const adjustStockSchema = z
  .object({
    type: z.enum(["STOCK_IN", "STOCK_OUT", "WASTAGE"]),
    quantity: z.coerce.number().positive("Quantity must be greater than zero."),
    reason: z.string().optional().or(z.literal("")),
    reference: z.string().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.type === "WASTAGE" && !data.reason?.trim()) {
      ctx.addIssue({ code: "custom", message: "Reason is required for wastage.", path: ["reason"] });
    }
  });

const movementTypeMap = {
  STOCK_IN: "MANUAL_ADJUST_IN",
  STOCK_OUT: "MANUAL_ADJUST_OUT",
  WASTAGE: "WASTAGE",
} as const;

async function tenantIdOrNull() {
  const session = await getServerSession(authOptions);
  return session?.user.tenantId ?? null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const parsed = adjustStockSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid stock adjustment." },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    const isOutgoing = payload.type === "STOCK_OUT" || payload.type === "WASTAGE";

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id, tenantId } });

      if (!product) {
        return { error: "Product not found.", status: 404 as const };
      }

      const currentStock = Number(product.currentStock);

      if (isOutgoing && payload.quantity > currentStock) {
        return {
          error: `Cannot remove ${payload.quantity} ${product.unit}; only ${currentStock} ${product.unit} in stock.`,
          status: 400 as const,
        };
      }

      const nextStock = isOutgoing ? currentStock - payload.quantity : currentStock + payload.quantity;

      const updated = await tx.product.update({
        where: { id },
        data: { currentStock: nextStock },
      });

      const movement = await tx.stockMovement.create({
        data: {
          tenantId,
          productId: id,
          type: movementTypeMap[payload.type],
          quantity: payload.quantity,
          reason: payload.reason || null,
          reference: payload.reference || null,
        },
      });

      return {
        product: { ...updated, currentStock: Number(updated.currentStock) },
        movement: { ...movement, quantity: Number(movement.quantity) },
      };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Failed to adjust stock", error);
    return NextResponse.json({ error: "Unable to adjust stock." }, { status: 500 });
  }
}
