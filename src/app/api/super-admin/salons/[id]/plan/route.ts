import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { istWallTimeToInstant, todayISTDateString } from "@/lib/time";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const planSchema = z
  .object({
    plan: z.enum(["FREE_TRIAL", "FREE", "MONTHLY", "YEARLY"]),
    // Trial start is not persisted (Tenant has no trialStartsAt column) — it is only
    // used here to validate that the trial end date is not before it.
    trialStart: z.string().regex(DATE_RE).optional().nullable(),
    trialEnd: z.string().regex(DATE_RE).optional().nullable(),
    subscriptionStart: z.string().regex(DATE_RE).optional().nullable(),
    subscriptionEnd: z.string().regex(DATE_RE).optional().nullable(),
  })
  .refine(
    (data) => data.plan !== "FREE_TRIAL" || Boolean(data.trialEnd),
    { message: "Trial end date is required", path: ["trialEnd"] },
  )
  .refine(
    (data) => !data.trialEnd || !data.trialStart || data.trialEnd >= data.trialStart,
    { message: "Trial end date cannot be before the start date", path: ["trialEnd"] },
  )
  .refine(
    (data) => !data.subscriptionEnd || !data.subscriptionStart || data.subscriptionEnd >= data.subscriptionStart,
    { message: "End date cannot be before the start date", path: ["subscriptionEnd"] },
  );

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = planSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { id: true } });

  if (!tenant) {
    return NextResponse.json({ error: "Salon not found" }, { status: 404 });
  }

  const { plan, trialEnd, subscriptionStart, subscriptionEnd } = parsed.data;
  const isPaidPlan = plan === "MONTHLY" || plan === "YEARLY";

  const updated = await prisma.tenant.update({
    where: { id },
    data: {
      plan,
      isSubscribed: isPaidPlan,
      subscriptionStart: isPaidPlan
        ? istWallTimeToInstant(subscriptionStart ?? todayISTDateString())
        : null,
      subscriptionEnd: isPaidPlan && subscriptionEnd ? istWallTimeToInstant(subscriptionEnd) : null,
      // Only a FREE_TRIAL change writes trialEndsAt — the single source of truth for
      // a trial's end date — through this shared field; other plans leave it untouched.
      trialEndsAt: plan === "FREE_TRIAL" && trialEnd ? istWallTimeToInstant(trialEnd) : undefined,
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
