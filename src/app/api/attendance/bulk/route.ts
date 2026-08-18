import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LEAVE" | "HALF_DAY";

const bulkSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attendances: z
    .array(
      z.object({
        staffId: z.string().cuid(),
        status: z.enum(["PRESENT", "ABSENT", "LEAVE", "HALF_DAY"]),
      }),
    )
    .min(1),
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

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = bulkSchema.safeParse(body);

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

    const staffIds = [...new Set(payload.attendances.map((item) => item.staffId))];

    const validStaff = await prisma.staff.findMany({
      where: {
        tenantId: session.user.tenantId,
        id: {
          in: staffIds,
        },
      },
      select: {
        id: true,
      },
    });

    const validSet = new Set(validStaff.map((item) => item.id));
    const filtered = payload.attendances.filter((item) => validSet.has(item.staffId));

    await prisma.$transaction(
      filtered.flatMap((item) => {
        const operations: Prisma.PrismaPromise<unknown>[] = [
          prisma.attendance.upsert({
            where: {
              staffId_date: {
                staffId: item.staffId,
                date,
              },
            },
            update: {
              status: item.status,
            },
            create: {
              tenantId: session.user.tenantId,
              staffId: item.staffId,
              date,
              status: item.status,
            },
          }),
        ];

        if (date.getTime() === today.getTime()) {
          operations.push(
            prisma.staff.update({
              where: {
                id: item.staffId,
              },
              data: {
                availabilityStatus: availabilityFromStatus(item.status),
              },
            }),
          );
        }

        return operations;
      }),
    );

    return NextResponse.json({
      success: true,
      successCount: filtered.length,
    });
  } catch (error) {
    console.error("Failed to save bulk attendance", error);
    return NextResponse.json({ error: "Unable to save attendance." }, { status: 500 });
  }
}
