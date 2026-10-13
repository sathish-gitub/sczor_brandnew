import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/enforceAccess";
import { prisma } from "@/lib/prisma";
import { attendanceDateInstant, findAttendanceIdsForDay } from "@/lib/attendanceDate";
import { todayISTDateString } from "@/lib/time";
import type { Prisma } from "@/generated/prisma/client";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LEAVE" | "HALF_DAY" | "WEEK_OFF";

const bulkSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attendances: z
    .array(
      z.object({
        staffId: z.string().cuid(),
        status: z.enum(["PRESENT", "ABSENT", "LEAVE", "HALF_DAY", "WEEK_OFF"]),
      }),
    )
    .min(1),
});

function availabilityFromStatus(status: AttendanceStatus) {
  if (status === "ABSENT" || status === "LEAVE" || status === "WEEK_OFF") {
    return "OFF_DUTY" as const;
  }

  return "AVAILABLE" as const;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await checkWriteAccess(session.user.tenantId);
  if (!access.allowed) {
    return NextResponse.json(
      { error: "SUBSCRIPTION_REQUIRED", message: access.reason },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const parsed = bulkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
    }

    const payload = parsed.data;
    const todayStr = todayISTDateString();
    if (payload.date > todayStr) {
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

    const existingIds = await findAttendanceIdsForDay(session.user.tenantId, staffIds, payload.date);
    const dateInstant = attendanceDateInstant(payload.date);
    const isToday = payload.date === todayStr;

    await prisma.$transaction(
      filtered.flatMap((item) => {
        const existingId = existingIds.get(item.staffId);
        const operations: Prisma.PrismaPromise<unknown>[] = [
          existingId
            ? prisma.attendance.update({
                where: { id: existingId },
                data: { status: item.status },
              })
            : prisma.attendance.create({
                data: {
                  tenantId: session.user.tenantId,
                  staffId: item.staffId,
                  date: dateInstant,
                  status: item.status,
                },
              }),
        ];

        if (isToday) {
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
