import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveDayBusinessHours } from "@/lib/businessHours";
import {
  resolveAttendanceDisplayStatus,
  type AttendanceStatusValue,
  type DisplayAttendanceStatus,
} from "@/lib/attendanceStatus";
import { currentISTMonthYear, daysInMonthIST, endOfMonthIST, getISTDayOfMonth, getISTMonth, getISTYear, startOfMonthIST } from "@/lib/time";
import { getStaffDesignationName, staffDesignationSelect } from "@/lib/staffDesignation";

type CellStatus = DisplayAttendanceStatus;

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthBounds(year: number, month: number) {
  return { start: startOfMonthIST(year, month), end: endOfMonthIST(year, month) };
}

function weekdayLabelFromDate(date: Date) {
  // Pure (year, month, day) round-trip through host-local Date fields: this
  // determines the real-world Gregorian weekday for a given calendar date,
  // which does not depend on timezone offset, so it stays correct
  // regardless of the host process timezone.
  return weekdayLabels[date.getDay()];
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function toDayMap(
  entries: Array<{ date: Date; status: AttendanceStatusValue }>,
  year: number,
  month: number,
) {
  const map = new Map<number, AttendanceStatusValue>();

  for (const entry of entries) {
    if (getISTYear(entry.date) === year && getISTMonth(entry.date) === month) {
      map.set(getISTDayOfMonth(entry.date), entry.status);
    }
  }

  return map;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const url = new URL(request.url);

  const istDefaults = currentISTMonthYear();
  const month = Number(url.searchParams.get("month") ?? istDefaults.month);
  const year = Number(url.searchParams.get("year") ?? istDefaults.year);
  const staffId = url.searchParams.get("staffId")?.trim() || null;

  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 3000) {
    return NextResponse.json({ error: "Invalid month or year." }, { status: 400 });
  }

  const { start, end } = monthBounds(year, month);
  const daysInMonth = daysInMonthIST(year, month);

  try {
    // Sequential queries (tenant, then salon settings) so every day of the
    // month can resolve its business hours synchronously below, instead of
    // one business-hours query per day of the month.
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { openTime: true, closeTime: true, workingDays: true },
    });

    const settings = tenant
      ? await prisma.salonSettings.findUnique({
          where: { tenantId },
          select: {
            mondayEnabled: true,
            mondayOpen: true,
            mondayClose: true,
            tuesdayEnabled: true,
            tuesdayOpen: true,
            tuesdayClose: true,
            wednesdayEnabled: true,
            wednesdayOpen: true,
            wednesdayClose: true,
            thursdayEnabled: true,
            thursdayOpen: true,
            thursdayClose: true,
            fridayEnabled: true,
            fridayOpen: true,
            fridayClose: true,
            saturdayEnabled: true,
            saturdayOpen: true,
            saturdayClose: true,
            sundayEnabled: true,
            sundayOpen: true,
            sundayClose: true,
          },
        })
      : null;

    const staffList = await prisma.staff.findMany({
      where: {
        tenantId,
        // The default matrix view only lists active staff; an explicitly
        // selected staffId (single-staff view) is shown regardless of
        // status since the caller already knows which staff member they want.
        ...(staffId ? { id: staffId } : { status: "ACTIVE" }),
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        ...staffDesignationSelect,
      },
    });

    if (staffList.length === 0) {
      return NextResponse.json({
        month,
        year,
        days: [],
        items: [],
      });
    }

    const staffIds = staffList.map((item) => item.id);

    const attendance = await prisma.attendance.findMany({
      where: {
        tenantId,
        staffId: {
          in: staffIds,
        },
        date: {
          gte: start,
          lt: end,
        },
      },
      orderBy: {
        date: "asc",
      },
      select: {
        staffId: true,
        date: true,
        status: true,
      },
    });

    const attendanceByStaff = new Map<string, Array<{ date: Date; status: AttendanceStatusValue }>>();

    for (const entry of attendance) {
      const list = attendanceByStaff.get(entry.staffId) ?? [];
      list.push({ date: entry.date, status: entry.status as AttendanceStatusValue });
      attendanceByStaff.set(entry.staffId, list);
    }

    const dayColumns = Array.from({ length: daysInMonth }).map((_, index) => {
      const day = index + 1;
      const date = new Date(year, month - 1, day);
      const dateStr = `${year}-${pad2(month)}-${pad2(day)}`;
      // Automatic Week Off is driven by the salon's business hours (shared
      // with the attendance page and the Day View calendar), not the
      // staff member's own `workingDays` roster field.
      const isBusinessWorkingDay = tenant ? resolveDayBusinessHours({ dateStr, settings, tenant }).enabled : true;

      return {
        day,
        weekday: weekdayLabelFromDate(date),
        isBusinessWorkingDay,
      };
    });

    const items = staffList.map((staff) => {
      const entryMap = toDayMap(attendanceByStaff.get(staff.id) ?? [], year, month);

      let present = 0;
      let absent = 0;
      let leave = 0;
      let halfDay = 0;
      let weekOff = 0;

      const cells = dayColumns.map((column) => {
        const storedStatus = entryMap.get(column.day) ?? null;
        const status: CellStatus = resolveAttendanceDisplayStatus({
          storedStatus,
          isBusinessWorkingDay: column.isBusinessWorkingDay,
        });

        if (status === "WEEK_OFF") {
          weekOff += 1;
        } else if (status === "PRESENT") {
          present += 1;
        } else if (status === "ABSENT") {
          absent += 1;
        } else if (status === "LEAVE") {
          leave += 1;
        } else if (status === "HALF_DAY") {
          halfDay += 1;
        }

        return {
          day: column.day,
          weekday: column.weekday,
          status,
        };
      });

      return {
        staffId: staff.id,
        name: staff.name,
        designation: getStaffDesignationName(staff),
        cells,
        summary: {
          present,
          absent,
          leave,
          halfDay,
          weekOff,
        },
      };
    });

    return NextResponse.json({
      month,
      year,
      days: dayColumns,
      items,
    });
  } catch (error) {
    console.error("Failed to load attendance reports", error);
    return NextResponse.json({ error: "Unable to load attendance report." }, { status: 500 });
  }
}
