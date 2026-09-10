import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantSalonStatus } from "@/lib/tenantStatus";

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

const PLAN_GROUP: Record<string, string> = {
  FREE_TRIAL: "Trial",
  FREE: "Trial",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
  BASIC: "Business",
  PRO: "Business",
};

const STATUS_GROUP: Record<string, string> = {
  TRIAL: "Trial",
  MONTHLY: "Active",
  YEARLY: "Active",
  EXPIRED: "Expired",
  INACTIVE: "Inactive",
};

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const url = new URL(request.url);
  const months = Math.min(24, Math.max(1, Number(url.searchParams.get("months")) || 6));

  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const [tenants, payments, invoices, appointmentCounts] = await Promise.all([
    prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        plan: true,
        isActive: true,
        isSubscribed: true,
        trialEndsAt: true,
        subscriptionEnd: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.findMany({
      where: { status: "SUCCESS" },
      select: { id: true, tenantId: true, plan: true, amount: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invoice.groupBy({
      by: ["tenantId"],
      where: { paymentStatus: "PAID" },
      _sum: { total: true },
    }),
    prisma.appointment.groupBy({
      by: ["tenantId"],
      _count: { _all: true },
    }),
  ]);

  const tenantNameById = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));

  // Salon growth: new tenant signups per month.
  const monthBuckets: Array<{ key: string; label: string }> = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthBuckets.push({ key: monthKey(monthDate), label: monthLabel(monthDate) });
  }

  const signupsByMonth = new Map<string, number>();
  for (const tenant of tenants) {
    if (tenant.createdAt < rangeStart) continue;
    const key = monthKey(tenant.createdAt);
    signupsByMonth.set(key, (signupsByMonth.get(key) ?? 0) + 1);
  }
  const salonGrowth = monthBuckets.map(({ key, label }) => ({ month: label, count: signupsByMonth.get(key) ?? 0 }));

  // Revenue overview: sum of successful payments per month.
  const revenueByMonth = new Map<string, number>();
  for (const payment of payments) {
    if (payment.createdAt < rangeStart) continue;
    const key = monthKey(payment.createdAt);
    revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + payment.amount);
  }
  const revenueOverview = monthBuckets.map(({ key, label }) => ({ month: label, revenue: revenueByMonth.get(key) ?? 0 }));

  // Subscription distribution: current plan grouping.
  const planCounts = new Map<string, number>([["Trial", 0], ["Monthly", 0], ["Yearly", 0], ["Business", 0]]);
  for (const tenant of tenants) {
    const group = PLAN_GROUP[tenant.plan] ?? "Trial";
    planCounts.set(group, (planCounts.get(group) ?? 0) + 1);
  }
  const subscriptionDistribution = ["Trial", "Monthly", "Yearly", "Business"].map((plan) => ({
    plan,
    count: planCounts.get(plan) ?? 0,
  }));

  // Salon status: derived via the same getTenantSalonStatus logic used elsewhere.
  const statusCounts = new Map<string, number>([["Active", 0], ["Trial", 0], ["Expired", 0], ["Inactive", 0]]);
  for (const tenant of tenants) {
    const rawStatus = getTenantSalonStatus(tenant, now);
    const group = STATUS_GROUP[rawStatus] ?? "Inactive";
    statusCounts.set(group, (statusCounts.get(group) ?? 0) + 1);
  }
  const salonStatus = ["Active", "Trial", "Expired", "Inactive"].map((status) => ({
    status,
    count: statusCounts.get(status) ?? 0,
  }));

  // Top salons: ranked by all-time paid invoice revenue.
  const appointmentCountByTenant = new Map(appointmentCounts.map((row) => [row.tenantId, row._count._all]));
  const topSalons = invoices
    .map((row) => ({
      name: tenantNameById.get(row.tenantId) ?? "Unknown",
      revenue: Math.round(Number(row._sum.total ?? 0)),
      appointments: appointmentCountByTenant.get(row.tenantId) ?? 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  // Recent activity: tenant signups + successful payments, merged and sorted.
  const signupEvents = tenants.slice(0, 15).map((tenant) => ({
    type: "signup" as const,
    tenantName: tenant.name,
    timestamp: tenant.createdAt.toISOString(),
    detail: "New salon registered",
  }));

  const paymentEvents = payments.slice(0, 15).map((payment) => ({
    type: "payment" as const,
    tenantName: tenantNameById.get(payment.tenantId) ?? "Unknown",
    timestamp: payment.createdAt.toISOString(),
    detail: `Payment of ₹${payment.amount.toLocaleString("en-IN")} received (${payment.plan} plan)`,
  }));

  const recentActivity = [...signupEvents, ...paymentEvents]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 15);

  return NextResponse.json(
    {
      salonGrowth,
      subscriptionDistribution,
      revenueOverview,
      salonStatus,
      topSalons,
      recentActivity,
    },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
  );
}
