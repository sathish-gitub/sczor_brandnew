import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const daySchema = z.object({
  day: z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
  enabled: z.boolean(),
  open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  break: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d-[0-2]\d:[0-5]\d$|^$/).optional().or(z.literal("")),
});

const schema = z.object({
  days: z.array(daySchema).length(7),
  slotDurationMinutes: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]),
  holidays: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      name: z.string().trim().min(2, "Holiday name is required."),
    }),
  ),
});

const dayFieldMap: Record<string, string> = {
  Mon: "monday",
  Tue: "tuesday",
  Wed: "wednesday",
  Thu: "thursday",
  Fri: "friday",
  Sat: "saturday",
  Sun: "sunday",
};

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
    }

    const data = parsed.data;

    const updates: Record<string, boolean | string | number | null> = {
      slotDurationMinutes: data.slotDurationMinutes,
    };

    const activeDays = data.days.filter((day) => day.enabled);

    for (const day of data.days) {
      const base = dayFieldMap[day.day];
      updates[`${base}Enabled`] = day.enabled;
      updates[`${base}Open`] = day.open;
      updates[`${base}Close`] = day.close;
      updates[`${base}Break`] = day.break || null;
    }

    await prisma.$transaction(async (tx) => {
      await tx.salonSettings.upsert({
        where: { tenantId: session.user.tenantId },
        create: {
          tenantId: session.user.tenantId,
          ...(updates as {
            slotDurationMinutes: number;
            mondayEnabled: boolean;
            mondayOpen: string;
            mondayClose: string;
            mondayBreak: string | null;
            tuesdayEnabled: boolean;
            tuesdayOpen: string;
            tuesdayClose: string;
            tuesdayBreak: string | null;
            wednesdayEnabled: boolean;
            wednesdayOpen: string;
            wednesdayClose: string;
            wednesdayBreak: string | null;
            thursdayEnabled: boolean;
            thursdayOpen: string;
            thursdayClose: string;
            thursdayBreak: string | null;
            fridayEnabled: boolean;
            fridayOpen: string;
            fridayClose: string;
            fridayBreak: string | null;
            saturdayEnabled: boolean;
            saturdayOpen: string;
            saturdayClose: string;
            saturdayBreak: string | null;
            sundayEnabled: boolean;
            sundayOpen: string;
            sundayClose: string;
            sundayBreak: string | null;
          }),
        },
        update: updates,
      });

      await tx.tenant.update({
        where: { id: session.user.tenantId },
        data: {
          workingDays: activeDays.map((day) => day.day),
          openTime: (activeDays[0]?.open ?? "09:00") as string,
          closeTime: (activeDays[0]?.close ?? "21:00") as string,
        },
      });

      await tx.holiday.deleteMany({ where: { tenantId: session.user.tenantId } });

      if (data.holidays.length > 0) {
        await tx.holiday.createMany({
          data: data.holidays.map((holiday) => ({
            tenantId: session.user.tenantId,
            name: holiday.name,
            date: new Date(`${holiday.date}T00:00:00.000Z`),
          })),
          skipDuplicates: true,
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update business hours", error);
    return NextResponse.json({ error: "Unable to update business hours right now." }, { status: 500 });
  }
}
