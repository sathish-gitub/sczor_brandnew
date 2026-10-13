import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadStaffLineWindowsForDate } from "@/lib/appointmentLines";
import { formatClockTime12Hour, istDayBounds } from "@/lib/time";
import { getStaffDesignationName, staffDesignationSelect } from "@/lib/staffDesignation";

function generateSlots(openTime: string, closeTime: string) {
  const [openHour, openMinute] = openTime.split(":").map(Number);
  const [closeHour, closeMinute] = closeTime.split(":").map(Number);

  let cursor = openHour * 60 + openMinute;
  const closeCursor = closeHour * 60 + closeMinute;
  const slots: string[] = [];

  while (cursor < closeCursor) {
    const hour = Math.floor(cursor / 60)
      .toString()
      .padStart(2, "0");
    const minute = (cursor % 60).toString().padStart(2, "0");
    slots.push(`${hour}:${minute}`);
    cursor += 30;
  }

  return slots;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const excludeAppointmentId = url.searchParams.get("excludeAppointmentId") ?? undefined;

  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: "Valid date is required." }, { status: 400 });
  }

  try {
    const { start, end } = istDayBounds(dateParam);

    const [tenant, staffMembers, windows] = await Promise.all([
      prisma.tenant.findUnique({
        where: {
          id: tenantId,
        },
        select: {
          openTime: true,
          closeTime: true,
        },
      }),
      prisma.staff.findMany({
        where: {
          tenantId,
          status: "ACTIVE",
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          ...staffDesignationSelect,
          attendances: {
            where: {
              date: {
                gte: start,
                lt: end,
              },
            },
            select: {
              status: true,
            },
            take: 1,
          },
        },
      }),
      loadStaffLineWindowsForDate({ tenantId, dateStr: dateParam, excludeAppointmentId }),
    ]);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    }

    const slots = generateSlots(tenant.openTime, tenant.closeTime);

    const windowsByStaff = new Map<string, typeof windows>();
    for (const window of windows) {
      const list = windowsByStaff.get(window.staffId);
      if (list) {
        list.push(window);
      } else {
        windowsByStaff.set(window.staffId, [window]);
      }
    }

    // Busy windows carry absolute instants (ISO strings) so the client can
    // compare them against each row's computed start/end without redoing any
    // timezone math, plus a ready-to-show "Busy h:mm AM to h:mm AM" label.
    const staff = staffMembers.map((member) => {
      const attendanceStatus = member.attendances[0]?.status ?? null;
      const offDuty = attendanceStatus === "ABSENT" || attendanceStatus === "LEAVE";

      const busyWindows = (windowsByStaff.get(member.id) ?? []).map((window) => ({
        start: window.startInstant.toISOString(),
        end: window.endInstant.toISOString(),
        label: `Busy ${formatClockTime12Hour(window.startClock)} to ${formatClockTime12Hour(window.endClock)}`,
      }));

      return {
        id: member.id,
        name: member.name,
        designation: getStaffDesignationName(member),
        offDuty,
        busyWindows,
      };
    });

    return NextResponse.json({
      slots,
      allSlots: slots,
      staff,
    });
  } catch (error) {
    console.error("Failed to load availability", error);

    return NextResponse.json(
      {
        error: "Unable to load available slots.",
      },
      { status: 500 },
    );
  }
}
