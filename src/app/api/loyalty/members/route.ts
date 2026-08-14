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
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? "20")));
  const search = url.searchParams.get("search")?.trim() ?? "";

  const where = {
    tenantId: session.user.tenantId,
    customer: search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              mobile: {
                contains: search,
              },
            },
          ],
        }
      : undefined,
  };

  try {
    const [total, cards] = await Promise.all([
      prisma.loyaltyCard.count({ where }),
      prisma.loyaltyCard.findMany({
        where,
        orderBy: {
          updatedAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              mobile: true,
            },
          },
          transactions: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
            select: {
              createdAt: true,
            },
          },
        },
      }),
    ]);

    const items = cards.map((card) => ({
      customerId: card.customer.id,
      customerName: card.customer.name,
      mobile: card.customer.mobile,
      tier: card.tier,
      points: card.totalPoints,
      totalSpent: Number(card.totalSpent),
      lastTransaction: card.transactions[0]?.createdAt ?? null,
    }));

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error("Failed to load loyalty members", error);
    return NextResponse.json({ error: "Unable to load members." }, { status: 500 });
  }
}
