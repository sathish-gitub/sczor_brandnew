import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const STOCK_IN_TYPES = new Set(["PURCHASE_IN", "MANUAL_ADJUST_IN"]);
const STOCK_OUT_TYPES = new Set(["SALE_OUT", "WASTAGE", "MANUAL_ADJUST_OUT"]);

function parseDate(value: string | null, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }

  return date;
}

function last30Days() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayKeys(start: Date, end: Date) {
  const keys: string[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);

  while (cursor <= last) {
    keys.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
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
  const from = parseDate(url.searchParams.get("startDate")) ?? fallback.start;
  const to = parseDate(url.searchParams.get("endDate"), true) ?? fallback.end;

  try {
    const [products, movements, purchaseOrders] = await Promise.all([
      prisma.product.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          unit: true,
          costPrice: true,
          sellingPrice: true,
          currentStock: true,
          isRetailItem: true,
          status: true,
          createdAt: true,
          category: { select: { name: true } },
        },
      }),
      prisma.stockMovement.findMany({
        where: { tenantId },
        select: {
          productId: true,
          type: true,
          quantity: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.purchaseOrder.findMany({
        where: { tenantId, createdAt: { gte: from, lte: to } },
        select: { status: true, totalAmount: true, receivedAt: true },
      }),
    ]);

    // ---- Stock Valuation ----
    let totalCostValue = 0;
    let totalRetailValue = 0;
    let totalUnits = 0;

    const categoryBuckets = new Map<string, { productCount: number; stockValue: number }>();

    for (const product of products) {
      const currentStock = Number(product.currentStock);
      const costPrice = Number(product.costPrice);
      const sellingPrice = Number(product.sellingPrice);

      totalCostValue += currentStock * costPrice;
      totalRetailValue += currentStock * sellingPrice;
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

    for (const movement of rangeMovements) {
      const quantity = Number(movement.quantity);
      const key = toDateKey(movement.createdAt);

      if (STOCK_IN_TYPES.has(movement.type)) {
        stockInByDay.set(key, (stockInByDay.get(key) ?? 0) + quantity);
      } else if (STOCK_OUT_TYPES.has(movement.type)) {
        stockOutByDay.set(key, (stockOutByDay.get(key) ?? 0) + quantity);
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

    return NextResponse.json({
      stockValuation: {
        totalCostValue: roundMoney(totalCostValue),
        totalRetailValue: roundMoney(totalRetailValue),
        totalProducts: products.length,
        totalUnits: roundMoney(totalUnits),
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
    });
  } catch (error) {
    console.error("Failed to load inventory report", error);
    return NextResponse.json({ error: "Unable to load inventory report." }, { status: 500 });
  }
}
