import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { calculatePL } from "@/lib/plCalculation";
import { currentISTMonthYear, endOfMonthIST, istDayBounds, startOfMonthIST } from "@/lib/time";

const monthLabels = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function parseDateOnlyParam(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  return value;
}

// `calculatePL` filters with an inclusive `lte` end bound, so the end instant
// returned here is the last millisecond of the IST calendar day/month.
function monthBoundsInclusive(year: number, month: number) {
  return { start: startOfMonthIST(year, month), end: new Date(endOfMonthIST(year, month).getTime() - 1) };
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const url = new URL(request.url);
  const startDateStr = parseDateOnlyParam(url.searchParams.get("startDate"));
  const endDateStr = parseDateOnlyParam(url.searchParams.get("endDate"));

  const istNow = currentISTMonthYear();
  const fallback = monthBoundsInclusive(istNow.year, istNow.month);
  const from = startDateStr ? istDayBounds(startDateStr).start : fallback.start;
  const to = endDateStr ? new Date(istDayBounds(endDateStr).end.getTime() - 1) : fallback.end;

  try {
    const current = await calculatePL(tenantId, from, to);

    // Pure (year, month) index arithmetic seeded from the IST "current" month;
    // this stays correct regardless of host timezone (no instant conversion).
    const trendMonths = Array.from({ length: 6 }).map((_, index) => {
      const totalMonthIndex = (istNow.month - 1) - (5 - index);
      const year = istNow.year + Math.floor(totalMonthIndex / 12);
      const month = (((totalMonthIndex % 12) + 12) % 12) + 1;
      return { year, month, ...monthBoundsInclusive(year, month) };
    });

    const trend = await Promise.all(
      trendMonths.map(async ({ year, month, start, end }) => {
        const pl = await calculatePL(tenantId, start, end);
        return {
          month: `${monthLabels[month - 1]} ${year}`,
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
