import { prisma } from "@/lib/prisma";

export type PLResult = {
  range: { startDate: string; endDate: string };
  revenue: {
    serviceRevenue: number;
    productRevenue: number;
    totalRevenue: number;
  };
  cogs: {
    productCost: number;
    note: string;
  };
  grossProfit: number;
  grossMarginPercent: number;
  operatingExpenses: {
    payrollCost: number;
    inventoryPurchases: number;
    loyaltyDiscounts: number;
    totalOperatingExpenses: number;
  };
  netProfit: number;
  netMarginPercent: number;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function monthsInRange(start: Date, end: Date) {
  const months: Array<{ month: number; year: number }> = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= last) {
    months.push({ month: cursor.getMonth() + 1, year: cursor.getFullYear() });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

/**
 * Builds a Profit & Loss breakdown for a tenant within [startDate, endDate].
 *
 * Net Profit reasoning:
 * Net Profit = Total Revenue - COGS - Payroll - Loyalty Discounts - Inventory Purchases.
 * Inventory Purchases (money spent receiving new stock this period) is included as a
 * real operating expense line here, matching a simple cash/period-basis P&L. This can
 * overlap with COGS (cost of products actually sold this period) when a purchase and
 * the sale of that same stock both fall in the same period - the report does not try
 * to net that overlap out. This is a deliberate v1 simplification: it keeps every
 * number on the statement fully transparent (nothing subtracted that isn't shown), at
 * the cost of Net Profit being understated in periods with heavy restocking. A more
 * precise version would track batch-level cost history to avoid the overlap entirely.
 */
export async function calculatePL(tenantId: string, startDate: Date, endDate: Date): Promise<PLResult> {
  const [invoices, saleMovements, payrolls, purchaseOrders, redemptions, salonSettings] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        tenantId,
        paymentStatus: "PAID",
        invoiceDate: { gte: startDate, lte: endDate },
      },
      select: {
        items: {
          select: { amount: true, serviceId: true, productId: true },
        },
      },
    }),
    prisma.stockMovement.findMany({
      where: {
        tenantId,
        type: "SALE_OUT",
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        quantity: true,
        product: { select: { costPrice: true } },
      },
    }),
    prisma.payroll.findMany({
      where: {
        tenantId,
        OR: monthsInRange(startDate, endDate),
      },
      select: { netPay: true },
    }),
    prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        status: "RECEIVED",
        receivedAt: { gte: startDate, lte: endDate },
      },
      select: { totalAmount: true },
    }),
    prisma.loyaltyTransaction.findMany({
      where: {
        type: "REDEEMED",
        createdAt: { gte: startDate, lte: endDate },
        loyaltyCard: { tenantId },
      },
      select: { points: true },
    }),
    prisma.salonSettings.findUnique({
      where: { tenantId },
      select: { rupeePerPoint: true },
    }),
  ]);

  let serviceRevenue = 0;
  let productRevenue = 0;

  for (const invoice of invoices) {
    for (const item of invoice.items) {
      const amount = Number(item.amount);
      if (item.serviceId) {
        serviceRevenue += amount;
      } else if (item.productId) {
        productRevenue += amount;
      }
    }
  }

  const totalRevenue = serviceRevenue + productRevenue;

  const productCost = saleMovements.reduce(
    (sum, movement) => sum + Number(movement.quantity) * Number(movement.product.costPrice),
    0,
  );

  const payrollCost = payrolls.reduce((sum, payroll) => sum + Number(payroll.netPay), 0);
  const inventoryPurchases = purchaseOrders.reduce((sum, order) => sum + Number(order.totalAmount), 0);
  const rupeePerPoint = Number(salonSettings?.rupeePerPoint ?? 1);
  const loyaltyDiscounts = redemptions.reduce((sum, txn) => sum + txn.points, 0) * rupeePerPoint;

  const grossProfit = totalRevenue - productCost;
  const totalOperatingExpenses = payrollCost + inventoryPurchases + loyaltyDiscounts;
  const netProfit = grossProfit - totalOperatingExpenses;

  const grossMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const netMarginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  return {
    range: {
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
    },
    revenue: {
      serviceRevenue: roundMoney(serviceRevenue),
      productRevenue: roundMoney(productRevenue),
      totalRevenue: roundMoney(totalRevenue),
    },
    cogs: {
      productCost: roundMoney(productCost),
      note: "Approximated using each product's current cost price, not historical cost at time of sale.",
    },
    grossProfit: roundMoney(grossProfit),
    grossMarginPercent: roundMoney(grossMarginPercent),
    operatingExpenses: {
      payrollCost: roundMoney(payrollCost),
      inventoryPurchases: roundMoney(inventoryPurchases),
      loyaltyDiscounts: roundMoney(loyaltyDiscounts),
      totalOperatingExpenses: roundMoney(totalOperatingExpenses),
    },
    netProfit: roundMoney(netProfit),
    netMarginPercent: roundMoney(netMarginPercent),
  };
}
