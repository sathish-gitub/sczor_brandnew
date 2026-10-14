import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/enforceAccess";
import { prisma } from "@/lib/prisma";
import { istWallTimeToInstant, todayISTDateString } from "@/lib/time";

const WASTAGE_REASONS = ["Expired", "Damaged", "Spilled", "Lost", "Other"] as const;

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date.");

const adjustStockSchema = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal("STOCK_IN"),
      quantity: z.coerce.number().positive("Quantity must be greater than zero."),
      reason: z.string().optional().or(z.literal("")),
      reference: z.string().optional().or(z.literal("")),
    }),
    z.object({
      type: z.literal("STOCK_OUT"),
      quantity: z.coerce.number().positive("Quantity must be greater than zero."),
      reason: z.string().optional().or(z.literal("")),
      reference: z.string().optional().or(z.literal("")),
    }),
    z.object({
      type: z.literal("WASTAGE"),
      quantity: z.coerce.number().positive("Quantity must be greater than zero."),
      occurredOn: dateOnly,
      reason: z.enum(WASTAGE_REASONS, { message: "Select a reason." }),
      notes: z.string().optional().or(z.literal("")),
    }),
    z.object({
      type: z.literal("USAGE"),
      quantity: z.coerce.number().positive("Quantity must be greater than zero."),
      periodStart: dateOnly,
      occurredOn: dateOnly,
      notes: z.string().optional().or(z.literal("")),
    }),
  ])
  .superRefine((data, ctx) => {
    const today = todayISTDateString();

    if (data.type === "WASTAGE") {
      if (data.reason === "Other" && !data.notes?.trim()) {
        ctx.addIssue({ code: "custom", message: "Notes are required when reason is Other.", path: ["notes"] });
      }

      if (data.occurredOn > today) {
        ctx.addIssue({ code: "custom", message: "Date cannot be in the future.", path: ["occurredOn"] });
      }
    }

    if (data.type === "USAGE") {
      if (data.occurredOn > today) {
        ctx.addIssue({ code: "custom", message: "To Date cannot be in the future.", path: ["occurredOn"] });
      }

      if (data.periodStart > data.occurredOn) {
        ctx.addIssue({ code: "custom", message: "From Date cannot be after To Date.", path: ["periodStart"] });
      }
    }
  });

const movementTypeMap = {
  STOCK_IN: "MANUAL_ADJUST_IN",
  STOCK_OUT: "MANUAL_ADJUST_OUT",
  WASTAGE: "WASTAGE",
  USAGE: "USAGE",
} as const;

const OUTGOING_ADJUST_TYPES = new Set(["STOCK_OUT", "WASTAGE", "USAGE"]);

async function sessionUserOrNull() {
  const session = await getServerSession(authOptions);
  if (!session?.user.tenantId) {
    return null;
  }
  return { tenantId: session.user.tenantId, userId: session.user.id as string | undefined };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await sessionUserOrNull();

  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenantId, userId } = sessionUser;

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
    const isOutgoing = OUTGOING_ADJUST_TYPES.has(payload.type);

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
          reason: payload.type === "WASTAGE" ? payload.reason : payload.type === "USAGE" ? null : payload.reason || null,
          reference: payload.type === "STOCK_IN" || payload.type === "STOCK_OUT" ? payload.reference || null : null,
          notes: payload.type === "WASTAGE" || payload.type === "USAGE" ? payload.notes?.trim() || null : null,
          occurredOn:
            payload.type === "WASTAGE" || payload.type === "USAGE" ? istWallTimeToInstant(payload.occurredOn) : null,
          periodStart: payload.type === "USAGE" ? istWallTimeToInstant(payload.periodStart) : null,
          createdById: userId ?? null,
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
