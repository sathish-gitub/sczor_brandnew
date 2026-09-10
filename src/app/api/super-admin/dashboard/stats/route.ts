import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { PRICING_PLANS } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { getTenantSalonStatus } from "@/lib/tenantStatus";

const MONTHLY_PRICE = PRICING_PLANS.MONTHLY.price;
const YEARLY_PRICE = PRICING_PLANS.YEARLY.price;

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      plan: true,
      isActive: true,
      isSubscribed: true,
      trialEndsAt: true,
      subscriptionEnd: true,
      subscriptionStart: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  let totalSalons = 0;
  let activeSalons = 0;
  let trialSalons = 0;
  let monthlySubscribers = 0;
  let yearlySubscribers = 0;
  let yearlySignupsThisMonth = 0;

  for (const tenant of tenants) {
    totalSalons += 1;
    if (tenant.isActive) activeSalons += 1;

    const status = getTenantSalonStatus(tenant, now);
    if (status === "TRIAL") trialSalons += 1;
    if (status === "MONTHLY") monthlySubscribers += 1;
    if (status === "YEARLY") {
      yearlySubscribers += 1;
      if (tenant.subscriptionStart && tenant.subscriptionStart >= monthStart) {
        yearlySignupsThisMonth += 1;
      }
    }
  }

  const monthlyRecurring = monthlySubscribers * MONTHLY_PRICE;
  const yearlyThisMonth = yearlySignupsThisMonth * YEARLY_PRICE;
  const totalMRR = monthlyRecurring + Math.round((yearlySubscribers * YEARLY_PRICE) / 12);

  const monthlySignups: Array<{ month: string; count: number }> = [];
  for (let i = 5; i >= 0; i -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const count = tenants.filter((tenant) => tenant.createdAt >= start && tenant.createdAt < end).length;
    monthlySignups.push({
      month: start.toLocaleDateString("en-US", { month: "short" }),
      count,
    });
  }

  const expiredSalons = tenants.filter((tenant) => getTenantSalonStatus(tenant, now) === "EXPIRED").length;

  const [totalRevenueAgg, monthRevenueAgg, failedPayments] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: "SUCCESS" },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: "SUCCESS", createdAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.payment.count({ where: { status: "FAILED" } }),
  ]);

  const totalRevenue = totalRevenueAgg._sum.amount ?? 0;
  const monthRevenue = monthRevenueAgg._sum.amount ?? 0;

  const subscriptionBreakdown = [
    { label: "Trial", key: "TRIAL", count: trialSalons },
    { label: "Monthly", key: "MONTHLY", count: monthlySubscribers },
    { label: "Yearly", key: "YEARLY", count: yearlySubscribers },
    { label: "Expired", key: "EXPIRED", count: expiredSalons },
  ].map((item) => ({
    ...item,
    percent: totalSalons > 0 ? Math.round((item.count / totalSalons) * 100) : 0,
  }));

  const recentSalons = tenants.slice(0, 10).map((tenant) => ({
    id: tenant.id,
    name: tenant.name,
    status: getTenantSalonStatus(tenant, now),
    createdAt: tenant.createdAt,
    isActive: tenant.isActive,
  }));

  return NextResponse.json({
    stats: {
      totalSalons,
      activeSalons,
      trialSalons,
      monthlySubscribers,
      yearlySubscribers,
      monthlyRevenue: monthlyRecurring,
      totalRevenue,
      monthRevenue,
      failedPayments,
    },
    revenue: {
      monthlyRecurring,
      yearlyThisMonth,
      totalMRR,
      totalRevenue,
      monthRevenue,
      failedPayments,
    },
    monthlySignups,
    subscriptionBreakdown,
    recentSalons,
  });
}
