import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  defaultPaidLeavesPerMonth: z.coerce.number().int().min(0).max(31),
});

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId || !session.user.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Only owner can update payroll settings." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
    }

    await prisma.salonSettings.upsert({
      where: { tenantId: session.user.tenantId },
      create: {
        tenantId: session.user.tenantId,
        defaultPaidLeavesPerMonth: parsed.data.defaultPaidLeavesPerMonth,
      },
      update: {
        defaultPaidLeavesPerMonth: parsed.data.defaultPaidLeavesPerMonth,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update payroll settings", error);
    return NextResponse.json({ error: "Unable to update payroll settings right now." }, { status: 500 });
  }
}
