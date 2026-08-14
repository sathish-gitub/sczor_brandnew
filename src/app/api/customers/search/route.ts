import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@/generated/prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getTenantId() {
  const session = await getServerSession(authOptions);
  if (!session?.user.tenantId) {
    return null;
  }

  return session.user.tenantId;
}

export async function GET(request: Request) {
  const tenantId = await getTenantId();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const mobile = url.searchParams.get("mobile")?.trim();
  const name = url.searchParams.get("name")?.trim();

  if (!mobile && !name) {
    return NextResponse.json({ items: [] });
  }

  const orFilters: Prisma.CustomerWhereInput[] = [];

  if (mobile) {
    orFilters.push({
      mobile: {
        contains: mobile,
      },
    });
  }

  if (name) {
    orFilters.push({
      name: {
        contains: name,
        mode: "insensitive",
      },
    });
  }

  const where: Prisma.CustomerWhereInput = {
    tenantId,
    OR: orFilters,
  };

  const customers = await prisma.customer.findMany({
    where,
    take: 20,
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      name: true,
      mobile: true,
      email: true,
      loyaltyCard: {
        select: {
          totalPoints: true,
        },
      },
    },
  });

  return NextResponse.json({
    items: customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      mobile: customer.mobile,
      email: customer.email,
      loyaltyPoints: customer.loyaltyCard?.totalPoints ?? 0,
    })),
  });
}
