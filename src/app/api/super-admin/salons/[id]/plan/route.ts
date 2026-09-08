import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const planSchema = z.object({
  plan: z.enum(["FREE_TRIAL", "FREE", "MONTHLY", "YEARLY"]),
  subscriptionStart: z.string().optional().nullable(),
  subscriptionEnd: z.string().optional().nullable(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = planSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { id: true } });

  if (!tenant) {
    return NextResponse.json({ error: "Salon not found" }, { status: 404 });
  }

  const { plan, subscriptionStart, subscriptionEnd } = parsed.data;
  const isPaidPlan = plan === "MONTHLY" || plan === "YEARLY";

  const updated = await prisma.tenant.update({
    where: { id },
    data: {
      plan,
      isSubscribed: isPaidPlan,
      subscriptionStart: subscriptionStart ? new Date(subscriptionStart) : isPaidPlan ? new Date() : null,
      subscriptionEnd: subscriptionEnd ? new Date(subscriptionEnd) : null,
      trialEndsAt:
        plan === "FREE_TRIAL"
          ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
          : undefined,
    },
    select: {
      id: true,
      plan: true,
      isSubscribed: true,
      subscriptionStart: true,
      subscriptionEnd: true,
      trialEndsAt: true,
    },
  });

  return NextResponse.json({ salon: updated });
}
