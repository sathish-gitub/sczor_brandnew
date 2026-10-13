import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/enforceAccess";
import { prisma } from "@/lib/prisma";
import { getBusinessHoursForDate } from "@/lib/businessHours";
import { resolveAttendanceDisplayStatus, type AttendanceStatusValue } from "@/lib/attendanceStatus";
import { getStaffDesignationName } from "@/lib/staffDesignation";
import { getISTAgeYears, istDayBounds, istWallTimeToInstant, todayISTDateString, toISTDateString } from "@/lib/time";

const dateOnlyString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date.");

const createStaffSchema = z.object({
  name: z.string().trim().min(2, "Name is required."),
  designationId: z.string().min(1, "Designation is required."),
  mobile: z.string().trim().regex(/^\d{10}$/).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  workingDays: z.array(z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]))
    .min(1, "Select at least one working day."),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  availabilityStatus: z.enum(["AVAILABLE", "BUSY", "OFF_DUTY"]).default("AVAILABLE"),
  dateOfBirth: dateOnlyString.nullable().optional(),
  joiningDate: dateOnlyString.nullable().optional(),
  experienceYears: z.number().min(0).max(60).nullable().optional(),
  specializations: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
});

function validateDobAndJoining(dateOfBirth?: string | null, joiningDate?: string | null) {
  const today = todayISTDateString();

  if (dateOfBirth) {
    if (dateOfBirth >= today) {
      return "Date of birth must be in the past.";
    }
    if (getISTAgeYears(dateOfBirth, today) < 14) {
      return "Staff member must be at least 14 years old.";
    }
  }

  if (joiningDate) {
    const oneYearFromToday = toISTDateString(
      new Date(istWallTimeToInstant(today, "00:00").getTime() + 366 * 24 * 60 * 60 * 1000),
    );
    if (joiningDate > oneYearFromToday) {
      return "Joining date cannot be more than 1 year in the future.";
    }
  }

  return null;
}

async function tenantIdOrNull() {
  const session = await getServerSession(authOptions);
  return session?.user.tenantId ?? null;
}

export async function GET(request: Request) {
  const tenantId = await tenantIdOrNull();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");
  const today = todayISTDateString();
  const { start, end } = istDayBounds(today);

  try {
    const businessHours = await getBusinessHoursForDate({ tenantId, dateStr: today });
    const isBusinessWorkingDay = !businessHours.closed;

    const [staff, todayLineCounts, totalLineCounts] = await Promise.all([
      prisma.staff.findMany({
        where: {
          tenantId,
          status: statusFilter && statusFilter !== "ALL" ? (statusFilter as "ACTIVE" | "INACTIVE") : undefined,
        },
        orderBy: { name: "asc" },
        include: {
          staffDesignation: { select: { name: true } },
          attendances: {
            where: {
              date: {
                gte: start,
                lt: end,
              },
            },
            take: 1,
            select: {
              status: true,
            },
          },
        },
      }),
      // "Today's Services" counts AppointmentService lines for today (not
      // cancelled), not appointments - the same person on two lines counts 2.
      prisma.appointmentService.groupBy({
        by: ["staffId"],
        where: {
          tenantId,
          staffId: { not: null },
          appointment: { appointmentDate: { gte: start, lt: end }, status: { not: "CANCELLED" } },
        },
        _count: { _all: true },
      }),
      // "Total Services" - all-time, all statuses (same scope as before).
      prisma.appointmentService.groupBy({
        by: ["staffId"],
        where: { tenantId, staffId: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const todayCountByStaff = new Map(todayLineCounts.map((row) => [row.staffId as string, row._count._all]));
    const totalCountByStaff = new Map(totalLineCounts.map((row) => [row.staffId as string, row._count._all]));

    const avgByStaff = new Map();

    const items = staff.map((member) => {
      const storedStatus = (member.attendances[0]?.status as AttendanceStatusValue | undefined) ?? null;
      const isInactive = member.status === "INACTIVE";
      const attendanceDisplayStatus = isInactive
        ? "INACTIVE"
        : resolveAttendanceDisplayStatus({ storedStatus, isBusinessWorkingDay });
      const todayCount = todayCountByStaff.get(member.id) ?? 0;
      const totalCount = totalCountByStaff.get(member.id) ?? 0;

      return {
        id: member.id,
        name: member.name,
        designation: getStaffDesignationName(member),
        mobile: member.mobile,
        email: member.email,
        status: member.status,
        // `availabilityStatus` is the separate manual scheduling field
        // (Available/Busy/Off Duty); `displayStatus` is the attendance
        // status shown everywhere else (Present/Absent/Leave/Week
        // Off/Half Day/Not Marked/Inactive), used by StaffCard.
        availabilityStatus: member.availabilityStatus,
        displayStatus: attendanceDisplayStatus,
        todayServicesDone: todayCount,
        totalServicesDone: totalCount,
        workingDays: member.workingDays,
        specializations: member.specializations,
        joiningDate: member.joiningDate,
        experienceYears: member.experienceYears === null ? null : Number(member.experienceYears),
        attendanceStatusToday: storedStatus,
        avgRating: avgByStaff.get(member.id) ?? 0,
        createdAt: member.createdAt,
      };
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Failed to list staff", error);
    return NextResponse.json({ error: "Unable to load staff." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const tenantId = await tenantIdOrNull();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await checkWriteAccess(tenantId);
  if (!access.allowed) {
    return NextResponse.json(
      { error: "SUBSCRIPTION_REQUIRED", message: access.reason },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const parsed = createStaffSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Invalid staff data.",
        },
        { status: 400 },
      );
    }

    const payload = parsed.data;

    const dobOrJoiningError = validateDobAndJoining(payload.dateOfBirth, payload.joiningDate);
    if (dobOrJoiningError) {
      return NextResponse.json({ error: dobOrJoiningError }, { status: 400 });
    }

    const designation = await prisma.staffDesignation.findFirst({
      where: { id: payload.designationId, tenantId },
      select: { id: true, name: true },
    });

    if (!designation) {
      return NextResponse.json({ error: "Select a valid designation." }, { status: 400 });
    }

    const created = await prisma.staff.create({
      data: {
        tenantId,
        name: payload.name,
        designation: designation.name,
        designationId: designation.id,
        mobile: payload.mobile || null,
        email: payload.email || null,
        workingDays: payload.workingDays,
        status: payload.status,
        availabilityStatus: payload.availabilityStatus,
        dateOfBirth: payload.dateOfBirth ? istWallTimeToInstant(payload.dateOfBirth, "00:00") : null,
        joiningDate: payload.joiningDate ? istWallTimeToInstant(payload.joiningDate, "00:00") : null,
        experienceYears: payload.experienceYears ?? null,
        specializations: payload.specializations ?? [],
      },
    });

    return NextResponse.json({ staff: created }, { status: 201 });
  } catch (error) {
    console.error("Failed to create staff", error);
    return NextResponse.json({ error: "Unable to create staff." }, { status: 500 });
  }
}
