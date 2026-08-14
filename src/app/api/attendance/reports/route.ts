import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LEAVE" | "HALF_DAY";

type CellStatus = AttendanceStatus | "OFF";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthBounds(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(year, month, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function weekdayLabelFromDate(date: Date) {
  return weekdayLabels[date.getDay()];
}

function toDayMap(
  entries: Array<{ date: Date; status: AttendanceStatus }>,
  year: number,
  month: number,
) {
  const map = new Map<number, AttendanceStatus>();

  for (const entry of entries) {
    if (entry.date.getFullYear() === year && entry.date.getMonth() === month - 1) {
      map.set(entry.date.getDate(), entry.status);
    }
  }

  return map;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);

  const now = new Date();
  const month = Number(url.searchParams.get("month") ?? now.getMonth() + 1);
  const year = Number(url.searchParams.get("year") ?? now.getFullYear());
  const staffId = url.searchParams.get("staffId")?.trim() || null;

  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 3000) {
    return NextResponse.json({ error: "Invalid month or year." }, { status: 400 });
  }

  const { start, end } = monthBounds(year, month);
  const daysInMonth = end.getDate();

  try {
    const staffList = await prisma.staff.findMany({
      where: {
        tenantId: session.user.tenantId,
        ...(staffId ? { id: staffId } : {}),
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        designation: true,
        workingDays: true,
      },
    });

    if (staffList.length === 0) {
      return NextResponse.json({
        month,
        year,
        days: [],
        overview: {
          workingDays: 0,
          avgAttendancePercent: 0,
          perfectAttendanceCount: 0,
          mostAbsentStaff: "-",
        },
        items: [],
      });
    }

    const staffIds = staffList.map((item) => item.id);

    const attendance = await prisma.attendance.findMany({
      where: {
        tenantId: session.user.tenantId,
        staffId: {
          in: staffIds,
        },
        date: {
          gte: start,
          lte: end,
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

    const attendanceByStaff = new Map<string, Array<{ date: Date; status: AttendanceStatus }>>();

    for (const entry of attendance) {
      const list = attendanceByStaff.get(entry.staffId) ?? [];
      list.push({ date: entry.date, status: entry.status as AttendanceStatus });
      attendanceByStaff.set(entry.staffId, list);
    }

    const dayColumns = Array.from({ length: daysInMonth }).map((_, index) => {
      const date = new Date(year, month - 1, index + 1);
      return {
        day: index + 1,
        weekday: weekdayLabelFromDate(date),
      };
    });

    let workingDaysThisMonth = 0;
    let avgAttendanceAccumulator = 0;
    let perfectAttendanceCount = 0;
    let highestAbsent = -1;
    let mostAbsentStaff = "-";

    const items = staffList.map((staff) => {
      const entryMap = toDayMap(attendanceByStaff.get(staff.id) ?? [], year, month);

      let present = 0;
      let absent = 0;
      let leave = 0;
      let halfDay = 0;
      let workingDays = 0;

      const cells = dayColumns.map((column) => {
        const weekday = column.weekday;
        const isWorkingDay = staff.workingDays.includes(weekday);

        if (isWorkingDay) {
          workingDays += 1;
        }

        const status = entryMap.get(column.day);

        if (!isWorkingDay) {
          return {
            day: column.day,
            weekday,
            status: "OFF" as CellStatus,
          };
        }

        if (status === "PRESENT") {
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
          weekday,
          status: (status ?? "OFF") as CellStatus,
        };
      });

      const attendancePercent = workingDays > 0 ? Math.round(((present + halfDay) / workingDays) * 100) : 0;

      workingDaysThisMonth = Math.max(workingDaysThisMonth, workingDays);
      avgAttendanceAccumulator += attendancePercent;
      if (attendancePercent === 100 && workingDays > 0) {
        perfectAttendanceCount += 1;
      }

      if (absent > highestAbsent) {
        highestAbsent = absent;
        mostAbsentStaff = staff.name;
      }

      return {
        staffId: staff.id,
        name: staff.name,
        designation: staff.designation,
        cells,
        summary: {
          present,
          absent,
          leave,
          halfDay,
          attendancePercent,
        },
      };
    });

    const avgAttendancePercent = Math.round(avgAttendanceAccumulator / items.length);

    return NextResponse.json({
      month,
      year,
      days: dayColumns,
      overview: {
        workingDays: workingDaysThisMonth,
        avgAttendancePercent,
        perfectAttendanceCount,
        mostAbsentStaff,
      },
      items,
    });
  } catch (error) {
    console.error("Failed to load attendance reports", error);
    return NextResponse.json({ error: "Unable to load attendance report." }, { status: 500 });
  }
}
