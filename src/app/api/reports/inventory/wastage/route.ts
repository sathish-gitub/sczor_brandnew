import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { computeReplenishment } from "@/lib/inventoryReplenishment";
import { prisma } from "@/lib/prisma";
import { formatPackSize } from "@/lib/productUnits";
import { istDayBounds, toISTDateString, todayISTDateString } from "@/lib/time";

const WASTAGE_REASONS = ["Expired", "Damaged", "Spilled", "Lost", "Other"] as const;
const MAX_EXPORT_ROWS = 50000;

function parseDateOnlyParam(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  return value;
}

// Inclusive end bound: the last millisecond of the IST calendar day.
function endOfDayInclusive(dateStr: string) {
  return new Date(istDayBounds(dateStr).end.getTime() - 1);
}

function firstOfMonthToTodayRange() {
  const todayStr = todayISTDateString();
  const [year, month] = todayStr.split("-");
  return { startDateStr: `${year}-${month}-01`, endDateStr: todayStr };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const url = new URL(request.url);

  const fallback = firstOfMonthToTodayRange();
  const startDateStr = parseDateOnlyParam(url.searchParams.get("startDate")) ?? fallback.startDateStr;
  const endDateStr = parseDateOnlyParam(url.searchParams.get("endDate")) ?? fallback.endDateStr;

  if (endDateStr < startDateStr) {
    return NextResponse.json({ error: "To Date cannot be before From Date." }, { status: 400 });
  }

  const productId = url.searchParams.get("productId")?.trim();
  const categoryId = url.searchParams.get("categoryId")?.trim();
  const reasonParam = url.searchParams.get("reason")?.trim();
  const reason = reasonParam && (WASTAGE_REASONS as readonly string[]).includes(reasonParam) ? reasonParam : undefined;

  const from = istDayBounds(startDateStr).start;
  const to = endOfDayInclusive(endDateStr);

  const where = {
    tenantId,
    type: "WASTAGE",
    productId: productId && productId !== "ALL" ? productId : undefined,
    reason: reason ?? undefined,
    product: categoryId && categoryId !== "ALL" ? { categoryId } : undefined,
    OR: [
      { occurredOn: { gte: from, lte: to } },
      { occurredOn: null, createdAt: { gte: from, lte: to } },
    ],
  };

  try {
    const totalMatching = await prisma.stockMovement.count({ where });

    if (totalMatching > MAX_EXPORT_ROWS) {
      return NextResponse.json(
        { error: `This report matches ${totalMatching} records. Please narrow the date range to 50,000 rows or fewer.` },
        { status: 400 },
      );
    }

    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            unit: true,
            packSize: true,
            costPrice: true,
            currentStock: true,
            reorderLevel: true,
            category: { select: { name: true } },
          },
        },
        createdBy: { select: { name: true } },
      },
      orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    });

    const rows = movements.map((movement) => {
      const quantity = Number(movement.quantity);
      const costPrice = Number(movement.product.costPrice);
      const reportDate = movement.occurredOn ?? movement.createdAt;

      return {
        id: movement.id,
        date: toISTDateString(reportDate),
        productId: movement.product.id,
        productName: movement.product.name,
        category: movement.product.category?.name ?? "Uncategorized",
        quantity: roundMoney(quantity),
        unit: formatPackSize(movement.product.unit, movement.product.packSize ? Number(movement.product.packSize) : null) ?? movement.product.unit.toUpperCase(),
        reason: movement.reason ?? "-",
        notes: movement.notes ?? "",
        costValue: roundMoney(quantity * costPrice),
        enteredBy: movement.createdBy?.name ?? "-",
      };
    });

    // ---- Summary ----
    const totalEntries = rows.length;
    const totalQuantity = roundMoney(rows.reduce((sum, row) => sum + row.quantity, 0));
    const totalCostValue = roundMoney(rows.reduce((sum, row) => sum + row.costValue, 0));

    const reasonCounts = new Map<string, number>();
    for (const row of rows) {
      reasonCounts.set(row.reason, (reasonCounts.get(row.reason) ?? 0) + 1);
    }
    const topReason = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";

    // ---- Replenishment (products that appear in the filtered wastage entries) ----
    const productsById = new Map<string, (typeof movements)[number]["product"]>();
    for (const movement of movements) {
      productsById.set(movement.product.id, movement.product);
    }

    const replenishment = [...productsById.values()]
      .map((product) => {
        const currentStock = Number(product.currentStock);
        const reorderLevel = Number(product.reorderLevel);
        const info = computeReplenishment(currentStock, reorderLevel, product.packSize ? Number(product.packSize) : null);

        return {
          productId: product.id,
          productName: product.name,
          currentStock: roundMoney(currentStock),
          reorderLevel: roundMoney(reorderLevel),
          status: info.status,
          statusLabel: info.statusLabel,
          suggestedReorderQty: roundMoney(info.suggestedReorderQty),
        };
      })
      .sort((a, b) => (a.status === b.status ? a.productName.localeCompare(b.productName) : a.status === "REORDER_NOW" ? -1 : 1));

    return NextResponse.json({
      rows,
      summary: { totalEntries, totalQuantity, totalCostValue, topReason },
      replenishment,
    });
  } catch (error) {
    console.error("Failed to load wastage report", error);
    return NextResponse.json({ error: "Unable to load wastage report." }, { status: 500 });
  }
}
