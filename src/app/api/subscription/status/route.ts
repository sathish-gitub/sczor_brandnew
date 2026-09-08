import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: {
      plan: true,
      trialEndsAt: true,
      isSubscribed: true,
      subscriptionStart: true,
      subscriptionEnd: true,
    },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const payments = await prisma.payment.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      plan: true,
      amount: true,
      status: true,
      periodStart: true,
      periodEnd: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    {
      subscription: tenant,
      payments,
    },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, private" } },
  );
}
