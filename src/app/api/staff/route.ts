import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createStaffSchema = z.object({
  name: z.string().trim().min(2, "Name is required."),
  designation: z.enum([
    "Beautician",
    "Hair Stylist",
    "Nail Artist",
    "Makeup Artist",
    "Spa Therapist",
    "Receptionist",
    "Manager",
  ]),
  mobile: z.string().trim().regex(/^\d{10}$/).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  workingDays: z.array(z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]))
    .min(1, "Select at least one working day."),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  availabilityStatus: z.enum(["AVAILABLE", "BUSY", "OFF_DUTY"]).default("AVAILABLE"),
});

async function tenantIdOrNull() {
  const session = await getServerSession(authOptions);
  return session?.user.tenantId ?? null;
}

function dayBounds(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export async function GET(request: Request) {
  const tenantId = await tenantIdOrNull();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");
  const { start, end } = dayBounds();

  try {
    const [staff, ratingRows] = await Promise.all([
      prisma.staff.findMany({
        where: {
          tenantId,
          status: statusFilter && statusFilter !== "ALL" ? (statusFilter as "ACTIVE" | "INACTIVE") : undefined,
        },
        orderBy: { name: "asc" },
        include: {
          appointments: {
            where: {
              appointmentDate: {
                gte: start,
                lte: end,
              },
              status: {
                not: "CANCELLED",
              },
            },
            select: {
              id: true,
            },
          },
          _count: {
            select: {
              appointments: true,
            },
          },
          attendances: {
            where: {
              date: {
                gte: start,
                lte: end,
              },
            },
            take: 1,
            select: {
              status: true,
            },
          },
        },
      }),
      prisma.staffRating.groupBy({
        by: ["staffId"],
        where: { tenantId },
        _avg: { rating: true },
      }),
    ]);

    const avgByStaff = new Map(
      ratingRows.map((row) => [row.staffId, Math.round((row._avg.rating ?? 0) * 10) / 10]),
    );

    const items = staff.map((member) => {
      const attendanceStatus = member.attendances[0]?.status;
      const isInactive = member.status === "INACTIVE";
      const effectiveAvailability =
        isInactive || attendanceStatus === "ABSENT" || attendanceStatus === "LEAVE"
          ? "OFF_DUTY"
          : member.availabilityStatus;
      const todayCount = member.appointments.length;
      const totalCount = member._count?.appointments ?? 0;

      return {
        id: member.id,
        name: member.name,
        designation: member.designation,
        mobile: member.mobile,
        email: member.email,
        status: member.status,
        availabilityStatus: effectiveAvailability ?? "AVAILABLE",
        displayStatus: isInactive ? "INACTIVE" : (effectiveAvailability ?? "AVAILABLE"),
        todayAppointments: todayCount,
        totalAppointments: totalCount,
        workingDays: member.workingDays,
        attendanceStatusToday: attendanceStatus ?? null,
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

    const created = await prisma.staff.create({
      data: {
        tenantId,
        name: payload.name,
        designation: payload.designation,
        mobile: payload.mobile || null,
        email: payload.email || null,
        workingDays: payload.workingDays,
        status: payload.status,
        availabilityStatus: payload.availabilityStatus,
      },
    });

    return NextResponse.json({ staff: created }, { status: 201 });
  } catch (error) {
    console.error("Failed to create staff", error);
    return NextResponse.json({ error: "Unable to create staff." }, { status: 500 });
  }
}
