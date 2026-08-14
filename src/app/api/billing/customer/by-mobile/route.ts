import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const mobile = url.searchParams.get("mobile")?.trim() ?? "";

  if (!/^\d{10}$/.test(mobile)) {
    return NextResponse.json({ error: "Enter a valid 10-digit mobile number." }, { status: 400 });
  }

  const customer = await prisma.customer.findFirst({
    where: {
      tenantId: session.user.tenantId,
      mobile,
    },
    select: {
      id: true,
      name: true,
      mobile: true,
      loyaltyCard: {
        select: {
          id: true,
          totalPoints: true,
          pointsRedeemed: true,
          totalSpent: true,
          tier: true,
        },
      },
    },
  });

  if (!customer) {
    return NextResponse.json({ customer: null });
  }

  return NextResponse.json({
    customer: {
      id: customer.id,
      name: customer.name,
      mobile: customer.mobile,
      loyalty: {
        cardId: customer.loyaltyCard?.id ?? null,
        totalPoints: customer.loyaltyCard?.totalPoints ?? 0,
        pointsRedeemed: customer.loyaltyCard?.pointsRedeemed ?? 0,
        totalSpent: Number(customer.loyaltyCard?.totalSpent ?? 0),
        tier: customer.loyaltyCard?.tier ?? "BRONZE",
      },
    },
  });
}
