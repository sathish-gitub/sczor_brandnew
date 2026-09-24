import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessStatus, getTrialStatus } from "@/lib/subscription";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: {
      trialEndsAt: true,
      isSubscribed: true,
      plan: true,
      subscriptionEnd: true,
    },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      trialStatus: getTrialStatus(tenant),
      access: getAccessStatus(tenant),
    },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, private" } },
  );
}
