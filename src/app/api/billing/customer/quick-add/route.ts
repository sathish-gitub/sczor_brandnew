import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().trim().min(2, "Customer name is required."),
  mobile: z.string().trim().regex(/^\d{10}$/, "Mobile must be 10 digits."),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid customer data." }, { status: 400 });
    }

    const payload = parsed.data;

    const existing = await prisma.customer.findFirst({
      where: {
        tenantId: session.user.tenantId,
        mobile: payload.mobile,
      },
      select: {
        id: true,
        name: true,
        mobile: true,
        loyaltyCard: {
          select: {
            totalPoints: true,
          },
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          customer: {
            id: existing.id,
            name: existing.name,
            mobile: existing.mobile,
            loyaltyPoints: existing.loyaltyCard?.totalPoints ?? 0,
          },
          alreadyExists: true,
        },
        { status: 200 },
      );
    }

    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          tenantId: session.user.tenantId,
          name: payload.name,
          mobile: payload.mobile,
        },
      });

      const card = await tx.loyaltyCard.create({
        data: {
          tenantId: session.user.tenantId,
          customerId: created.id,
        },
        select: {
          totalPoints: true,
        },
      });

      return {
        id: created.id,
        name: created.name,
        mobile: created.mobile,
        loyaltyPoints: card.totalPoints,
      };
    });

    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    console.error("Failed to quick add customer", error);
    return NextResponse.json({ error: "Unable to create customer." }, { status: 500 });
  }
}
