import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { computeReplenishment } from "@/lib/inventoryReplenishment";
import { prisma } from "@/lib/prisma";
import { formatPackSize } from "@/lib/productUnits";
import { istDayBounds, toISTDateString, todayISTDateString } from "@/lib/time";

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

  const from = istDayBounds(startDateStr).start;
  const to = endOfDayInclusive(endDateStr);
  // The report date is the usage "To Date" (occurredOn); a movement is included when its To Date falls in range.
  const rangeDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1);
  const weeksInRange = rangeDays / 7;

  const where = {
    tenantId,
    type: "USAGE",
    productId: productId && productId !== "ALL" ? productId : undefined,
    product: categoryId && categoryId !== "ALL" ? { categoryId } : undefined,
    occurredOn: { gte: from, lte: to },
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

      return {
        id: movement.id,
        periodStart: movement.periodStart ? toISTDateString(movement.periodStart) : null,
        periodEnd: movement.occurredOn ? toISTDateString(movement.occurredOn) : null,
        productId: movement.product.id,
        productName: movement.product.name,
        category: movement.product.category?.name ?? "Uncategorized",
        quantity: roundMoney(quantity),
        unit: formatPackSize(movement.product.unit, movement.product.packSize ? Number(movement.product.packSize) : null) ?? movement.product.unit.toUpperCase(),
        notes: movement.notes ?? "",
        costValue: roundMoney(quantity * costPrice),
        enteredBy: movement.createdBy?.name ?? "-",
      };
    });

    // ---- Summary ----
    const totalEntries = rows.length;
    const totalQuantity = roundMoney(rows.reduce((sum, row) => sum + row.quantity, 0));
    const totalCostValue = roundMoney(rows.reduce((sum, row) => sum + row.costValue, 0));
    const distinctProducts = new Set(rows.map((row) => row.productId));

    // ---- Usage by product: one grouped query, then a single lookup for product details. ----
    const grouped = await prisma.stockMovement.groupBy({
      by: ["productId"],
      where,
      _sum: { quantity: true },
      _count: { _all: true },
    });

    const productIds = grouped.map((group) => group.productId);
    const products = productIds.length
      ? await prisma.product.findMany({
          where: { id: { in: productIds }, tenantId },
          select: {
            id: true,
            name: true,
            unit: true,
            packSize: true,
            currentStock: true,
            reorderLevel: true,
            category: { select: { name: true } },
          },
        })
      : [];
    const productMap = new Map(products.map((product) => [product.id, product]));

    const byProduct = grouped
      .map((group) => {
        const product = productMap.get(group.productId);
        const totalQty = roundMoney(Number(group._sum.quantity ?? 0));
        const currentStock = product ? Number(product.currentStock) : 0;
        const reorderLevel = product ? Number(product.reorderLevel) : 0;
        const info = computeReplenishment(currentStock, reorderLevel, product?.packSize ? Number(product.packSize) : null);

        return {
          productId: group.productId,
          productName: product?.name ?? "Unknown product",
          category: product?.category?.name ?? "Uncategorized",
          totalQuantity: totalQty,
          unit: product ? formatPackSize(product.unit, product.packSize ? Number(product.packSize) : null) ?? product.unit.toUpperCase() : "",
          entries: group._count._all,
          averagePerWeek: roundMoney(totalQty / weeksInRange),
          currentStock: roundMoney(currentStock),
          reorderLevel: roundMoney(reorderLevel),
          status: info.status,
          statusLabel: info.statusLabel,
          suggestedReorderQty: roundMoney(info.suggestedReorderQty),
        };
      })
      .sort((a, b) => b.totalQuantity - a.totalQuantity);

    return NextResponse.json({
      rows,
      byProduct,
      summary: { totalEntries, totalQuantity, totalCostValue, productsUsed: distinctProducts.size },
    });
  } catch (error) {
    console.error("Failed to load usage report", error);
    return NextResponse.json({ error: "Unable to load usage report." }, { status: 500 });
  }
}
