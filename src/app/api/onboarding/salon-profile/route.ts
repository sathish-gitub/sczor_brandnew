import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const workingDaySchema = z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);

const salonProfileSchema = z.object({
  salonName: z.string().trim().min(2, "Salon name is required."),
  address: z.string().trim().min(5, "Address is required."),
  city: z.string().trim().min(2, "City is required."),
  state: z.string().trim().min(2, "State is required."),
  pincode: z.string().trim().regex(/^\d{6}$/, "Pincode must be 6 digits."),
  phone: z.string().trim().regex(/^\d{10}$/, "Phone number must be 10 digits."),
  gstNumber: z.string().trim().optional(),
  openTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid opening time."),
  closeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid closing time."),
  workingDays: z.array(workingDaySchema).min(1, "Select at least one working day."),
});

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = salonProfileSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message ?? "Invalid salon profile." },
        { status: 400 },
      );
    }

    const { salonName, gstNumber, ...profile } = result.data;

    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: {
          id: session.user.tenantId,
        },
        data: {
          name: salonName,
          gstNumber: gstNumber || null,
          ...profile,
        },
      });

      await tx.salonSettings.upsert({
        where: {
          tenantId: session.user.tenantId,
        },
        update: {
          onboardingStep1Done: true,
        },
        create: {
          tenantId: session.user.tenantId,
          onboardingStep1Done: true,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update salon profile", error);

    return NextResponse.json(
      { error: "Unable to save salon profile right now." },
      { status: 500 },
    );
  }
}