import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LEAVE" | "HALF_DAY";

const singleSchema = z.object({
  staffId: z.string().cuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["PRESENT", "ABSENT", "LEAVE", "HALF_DAY"]),
});

function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00`);
}

function availabilityFromStatus(status: AttendanceStatus) {
  if (status === "ABSENT" || status === "LEAVE") {
    return "OFF_DUTY" as const;
  }

  return "AVAILABLE" as const;
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = singleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
    }

    const payload = parsed.data;
    const date = parseDateOnly(payload.date);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date > today) {
      return NextResponse.json({ error: "Future date is not allowed." }, { status: 400 });
    }

    const member = await prisma.staff.findFirst({
      where: {
        tenantId: session.user.tenantId,
        id: payload.staffId,
      },
      select: {
        id: true,
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.attendance.upsert({
        where: {
          staffId_date: {
            staffId: payload.staffId,
            date,
          },
        },
        update: {
          status: payload.status,
        },
        create: {
          tenantId: session.user.tenantId,
          staffId: payload.staffId,
          date,
          status: payload.status,
        },
      }),
      prisma.staff.update({
        where: {
          id: payload.staffId,
        },
        data: {
          availabilityStatus: availabilityFromStatus(payload.status),
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save attendance", error);
    return NextResponse.json({ error: "Unable to save attendance." }, { status: 500 });
  }
}
