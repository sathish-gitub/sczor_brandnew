import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { computeReplenishment } from "@/lib/inventoryReplenishment";
import { prisma } from "@/lib/prisma";
import { istDayBounds, toISTDateString, todayISTDateString } from "@/lib/time";

const STOCK_IN_TYPES = new Set(["PURCHASE_IN", "MANUAL_ADJUST_IN"]);
const STOCK_OUT_TYPES = new Set(["SALE_OUT", "WASTAGE", "MANUAL_ADJUST_OUT", "USAGE"]);
const MAX_EXPORT_ROWS = 50000;

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  PURCHASE_IN: "Purchase",
  SALE_OUT: "Sale",
  MANUAL_ADJUST_IN: "Manual (In)",
  MANUAL_ADJUST_OUT: "Manual (Out)",
  WASTAGE: "Wastage",
  USAGE: "Usage",
};

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

function last30Days() {
  const todayStr = todayISTDateString();
  const end = endOfDayInclusive(todayStr);
  const startStr = toISTDateString(new Date(istDayBounds(todayStr).start.getTime() - 29 * 24 * 60 * 60 * 1000));
  const start = istDayBounds(startStr).start;
  return { start, end };
}

function dayKeys(start: Date, end: Date) {
  const keys: string[] = [];
  let cursorStr = toISTDateString(start);
  const endStr = toISTDateString(end);

  while (cursorStr <= endStr) {
    keys.push(cursorStr);
    cursorStr = toISTDateString(new Date(istDayBounds(cursorStr).start.getTime() + 24 * 60 * 60 * 1000));
  }

  return keys;
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

  const fallback = last30Days();
  const startDateStr = parseDateOnlyParam(url.searchParams.get("startDate"));
  const endDateStr = parseDateOnlyParam(url.searchParams.get("endDate"));
  const from = startDateStr ? istDayBounds(startDateStr).start : fallback.start;
  const to = endDateStr ? endOfDayInclusive(endDateStr) : fallback.end;

  try {
    const products = await prisma.product.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        unit: true,
        packSize: true,
        costPrice: true,
        sellingPrice: true,
        currentStock: true,
        reorderLevel: true,
        isRetailItem: true,
        status: true,
        createdAt: true,
        category: { select: { name: true } },
      },
    });

    const movements = await prisma.stockMovement.findMany({
      where: { tenantId },
      select: {
        productId: true,
        type: true,
        quantity: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: { tenantId, createdAt: { gte: from, lte: to } },
      select: { status: true, totalAmount: true, receivedAt: true },
    });

    // Total Sold Value: sum of product-line invoice amounts (pre invoice-level discount) for
    // invoices dated inside the selected range, excluding cancelled/refunded invoices.
    const soldValueAgg = await prisma.invoiceItem.aggregate({
      where: {
        productId: { not: null },
        invoice: {
          tenantId,
          invoiceDate: { gte: from, lte: to },
          paymentStatus: { notIn: ["CANCELLED", "REFUNDED"] },
        },
      },
      _sum: { amount: true },
    });
    const totalSoldValue = Number(soldValueAgg._sum.amount ?? 0);

    // ---- Stock Valuation ----
    let totalCostValue = 0;
    let totalUnits = 0;

    const categoryBuckets = new Map<string, { productCount: number; stockValue: number }>();

    for (const product of products) {
      const currentStock = Number(product.currentStock);
      const costPrice = Number(product.costPrice);

      totalCostValue += currentStock * costPrice;
      totalUnits += currentStock;

      const categoryName = product.category?.name ?? "Uncategorized";
      const bucket = categoryBuckets.get(categoryName) ?? { productCount: 0, stockValue: 0 };
      bucket.productCount += 1;
      bucket.stockValue += currentStock * costPrice;
      categoryBuckets.set(categoryName, bucket);
    }

    // ---- Movement-based metrics (date-range scoped) ----
    const rangeMovements = movements.filter((movement) => movement.createdAt >= from && movement.createdAt <= to);

    const stockInByDay = new Map<string, number>();
    const stockOutByDay = new Map<string, number>();
    const salesByProductInRange = new Map<string, number>();

    let salesOutInRange = 0;
    let usageOutInRange = 0;
    let wastageOutInRange = 0;

    for (const movement of rangeMovements) {
      const quantity = Number(movement.quantity);
      const key = toISTDateString(movement.createdAt);

      if (STOCK_IN_TYPES.has(movement.type)) {
        stockInByDay.set(key, (stockInByDay.get(key) ?? 0) + quantity);
      } else if (STOCK_OUT_TYPES.has(movement.type)) {
        stockOutByDay.set(key, (stockOutByDay.get(key) ?? 0) + quantity);
      }

      if (movement.type === "SALE_OUT") {
        salesOutInRange += quantity;
      } else if (movement.type === "USAGE") {
        usageOutInRange += quantity;
      } else if (movement.type === "WASTAGE") {
        wastageOutInRange += quantity;
      }

      if (movement.type === "SALE_OUT") {
        salesByProductInRange.set(movement.productId, (salesByProductInRange.get(movement.productId) ?? 0) + quantity);
      }
    }

    const stockMovementTrend = dayKeys(from, to).map((date) => ({
      date,
      stockIn: roundMoney(stockInByDay.get(date) ?? 0),
      stockOut: roundMoney(stockOutByDay.get(date) ?? 0),
    }));

    // ---- Top / slow moving products ----
    const productMap = new Map(products.map((product) => [product.id, product]));

    const lastSaleByProduct = new Map<string, Date>();
    for (const movement of movements) {
      if (movement.type !== "SALE_OUT") {
        continue;
      }
      if (!lastSaleByProduct.has(movement.productId)) {
        lastSaleByProduct.set(movement.productId, movement.createdAt);
      }
    }

    const topMovingProducts = [...salesByProductInRange.entries()]
      .map(([productId, unitsSold]) => {
        const product = productMap.get(productId);
        return {
          name: product?.name ?? "Unknown product",
          unitsSold: roundMoney(unitsSold),
          revenue: roundMoney(unitsSold * Number(product?.sellingPrice ?? 0)),
        };
      })
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, 8);

    const now = new Date();
    const retailProducts = products.filter((product) => product.isRetailItem && product.status === "ACTIVE");

    const slowMovingProducts = retailProducts
      .map((product) => {
        const unitsSold = roundMoney(salesByProductInRange.get(product.id) ?? 0);
        const lastSale = lastSaleByProduct.get(product.id) ?? product.createdAt;
        const daysSinceLastSale = Math.max(0, Math.floor((now.getTime() - lastSale.getTime()) / (1000 * 60 * 60 * 24)));

        return { name: product.name, unitsSold, daysSinceLastSale };
      })
      .sort((a, b) => (a.unitsSold - b.unitsSold) || (b.daysSinceLastSale - a.daysSinceLastSale))
      .slice(0, 8);

    // ---- Purchase order summary ----
    const totalOrders = purchaseOrders.length;
    const pendingOrders = purchaseOrders.filter((order) => order.status === "PENDING").length;
    const totalSpend = purchaseOrders
      .filter((order) => order.status === "RECEIVED" && order.receivedAt && order.receivedAt >= from && order.receivedAt <= to)
      .reduce((sum, order) => sum + Number(order.totalAmount), 0);

    // ---- Stock movement history (date-range scoped, capped for export safety) ----
    const movementTypeFilterMap: Record<string, string[]> = {
      PURCHASE: ["PURCHASE_IN"],
      SALE: ["SALE_OUT"],
      USAGE: ["USAGE"],
      WASTAGE: ["WASTAGE"],
      MANUAL: ["MANUAL_ADJUST_IN", "MANUAL_ADJUST_OUT"],
    };
    const movementTypeParam = url.searchParams.get("movementType")?.trim().toUpperCase();
    const movementTypeFilter = movementTypeParam ? movementTypeFilterMap[movementTypeParam] : undefined;
    const movementHistoryWhere = {
      tenantId,
      createdAt: { gte: from, lte: to },
      type: movementTypeFilter ? { in: movementTypeFilter } : undefined,
    };

    const movementHistoryCount = await prisma.stockMovement.count({ where: movementHistoryWhere });
    const movementHistoryTruncated = movementHistoryCount > MAX_EXPORT_ROWS;

    const movementHistoryRaw = movementHistoryTruncated
      ? []
      : await prisma.stockMovement.findMany({
          where: movementHistoryWhere,
          include: {
            product: { select: { name: true } },
            createdBy: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        });

    const movementHistory = movementHistoryRaw.map((movement) => ({
      id: movement.id,
      date: toISTDateString(movement.occurredOn ?? movement.createdAt),
      productName: movement.product.name,
      type: movement.type,
      typeLabel: MOVEMENT_TYPE_LABELS[movement.type] ?? movement.type,
      quantity: roundMoney(Number(movement.quantity)),
      reasonOrNotes: movement.notes?.trim() || movement.reason?.trim() || "-",
      enteredBy: movement.createdBy?.name ?? "-",
    }));

    // ---- Replenishment (all active products, current state) ----
    const replenishment = products
      .filter((product) => product.status === "ACTIVE")
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
      stockValuation: {
        totalCostValue: roundMoney(totalCostValue),
        totalSoldValue: roundMoney(totalSoldValue),
        totalProducts: products.length,
        totalUnits: roundMoney(totalUnits),
      },
      stockOutBreakdown: {
        sales: roundMoney(salesOutInRange),
        usage: roundMoney(usageOutInRange),
        wastage: roundMoney(wastageOutInRange),
      },
      topMovingProducts,
      slowMovingProducts,
      stockMovementTrend,
      categoryBreakdown: [...categoryBuckets.entries()].map(([category, value]) => ({
        category,
        productCount: value.productCount,
        stockValue: roundMoney(value.stockValue),
      })),
      purchaseOrderSummary: {
        totalOrders,
        pendingOrders,
        totalSpend: roundMoney(totalSpend),
      },
      movementHistory,
      movementHistoryTruncated,
      replenishment,
    });
  } catch (error) {
    console.error("Failed to load inventory report", error);
    return NextResponse.json({ error: "Unable to load inventory report." }, { status: 500 });
  }
}
