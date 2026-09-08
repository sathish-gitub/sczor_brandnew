import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantSalonStatus } from "@/lib/tenantStatus";

const MONTHLY_PRICE = 499;
const YEARLY_PRICE = 4999;

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenants = await prisma.tenant.findMany({
    where: { plan: { in: ["MONTHLY", "YEARLY"] } },
    include: {
      users: {
        where: { role: "OWNER" },
        take: 1,
        select: { name: true, email: true },
      },
    },
    orderBy: { subscriptionStart: "desc" },
  });

  const now = new Date();

  const monthly = [];
  const yearly = [];

  for (const tenant of tenants) {
    const owner = tenant.users[0] ?? null;
    const status = getTenantSalonStatus(tenant, now);
    const row = {
      id: tenant.id,
      salon: tenant.name,
      owner: owner?.name ?? "-",
      ownerEmail: owner?.email ?? tenant.email ?? "-",
      amount: tenant.plan === "MONTHLY" ? MONTHLY_PRICE : YEARLY_PRICE,
      start: tenant.subscriptionStart,
      end: tenant.subscriptionEnd,
      status,
    };

    if (tenant.plan === "MONTHLY") {
      monthly.push(row);
    } else {
      yearly.push(row);
    }
  }

  const monthlyMRR = monthly.length * MONTHLY_PRICE;
  const yearlyRevenue = yearly.length * YEARLY_PRICE;
  const totalMRR = monthlyMRR + Math.round(yearlyRevenue / 12);

  const recentPaymentsRaw = await prisma.payment.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      tenant: { select: { name: true } },
    },
  });

  const recentPayments = recentPaymentsRaw.map((payment) => ({
    id: payment.id,
    salon: payment.tenant.name,
    plan: payment.plan,
    amount: payment.amount,
    date: payment.createdAt,
    status: payment.status,
  }));

  return NextResponse.json({
    summary: {
      monthlyCount: monthly.length,
      monthlyPrice: MONTHLY_PRICE,
      monthlyMRR,
      yearlyCount: yearly.length,
      yearlyPrice: YEARLY_PRICE,
      yearlyRevenue,
      totalMRR,
    },
    monthly,
    yearly,
    recentPayments,
  });
}
