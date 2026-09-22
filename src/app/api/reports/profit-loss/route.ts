import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { calculatePL } from "@/lib/plCalculation";

const monthLabels = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

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

function monthBounds(base: Date = new Date()) {
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const url = new URL(request.url);
  const startDate = parseDate(url.searchParams.get("startDate"));
  const endDate = parseDate(url.searchParams.get("endDate"), true);

  const fallback = monthBounds();
  const from = startDate ?? fallback.start;
  const to = endDate ?? fallback.end;

  try {
    const current = await calculatePL(tenantId, from, to);

    const trendMonths = Array.from({ length: 6 }).map((_, index) => {
      const now = new Date();
      const base = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return monthBounds(base);
    });

    const trend = await Promise.all(
      trendMonths.map(async ({ start, end }) => {
        const pl = await calculatePL(tenantId, start, end);
        return {
          month: `${monthLabels[start.getMonth()]} ${start.getFullYear()}`,
          revenue: pl.revenue.totalRevenue,
          expenses: pl.operatingExpenses.totalOperatingExpenses + pl.cogs.productCost,
          netProfit: pl.netProfit,
        };
      }),
    );

    const revenueBreakdown = [
      { category: "Services", amount: current.revenue.serviceRevenue },
      { category: "Retail Products", amount: current.revenue.productRevenue },
    ];

    const expenseBreakdown = [
      { category: "Payroll", amount: current.operatingExpenses.payrollCost },
      { category: "Inventory Purchases", amount: current.operatingExpenses.inventoryPurchases },
      { category: "Loyalty Discounts", amount: current.operatingExpenses.loyaltyDiscounts },
      { category: "COGS", amount: current.cogs.productCost },
    ];

    return NextResponse.json({
      current,
      trend,
      revenueBreakdown,
      expenseBreakdown,
    });
  } catch (error) {
    console.error("Failed to load profit & loss report", error);
    return NextResponse.json({ error: "Unable to load profit & loss report." }, { status: 500 });
  }
}
