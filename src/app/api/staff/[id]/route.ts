import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateStaffSchema = z.object({
  name: z.string().trim().min(2).optional(),
  designation: z.enum([
    "Beautician",
    "Hair Stylist",
    "Nail Artist",
    "Makeup Artist",
    "Spa Therapist",
    "Receptionist",
    "Manager",
  ]).optional(),
  mobile: z.string().trim().regex(/^\d{10}$/).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  workingDays: z.array(z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]))
    .min(1)
    .optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  availabilityStatus: z.enum(["AVAILABLE", "BUSY", "OFF_DUTY"]).optional(),
});

async function tenantIdOrNull() {
  const session = await getServerSession(authOptions);
  return session?.user.tenantId ?? null;
}

function monthBounds(baseDate = new Date()) {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function weekBounds(baseDate = new Date()) {
  const day = baseDate.getDay();
  const offsetToMonday = (day + 6) % 7;
  const start = new Date(baseDate);
  start.setDate(baseDate.getDate() - offsetToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await tenantIdOrNull();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const month = monthBounds();
  const week = weekBounds();

  try {

    const [staff, ratingAgg] = await Promise.all([
      prisma.staff.findFirst({
        where: { id, tenantId },
        include: {
          appointments: {
          orderBy: [{ appointmentDate: "desc" }, { appointmentTime: "asc" }],
          include: {
            customer: {
              select: {
                name: true,
              },
            },
            service: {
              select: {
                name: true,
                category: true,
                price: true,
              },
            },
          },
        },
        attendances: {
          where: {
            date: {
              gte: month.start,
              lte: month.end,
            },
          },
          orderBy: {
            date: "asc",
          },
        },
      },
    });

    if (!staff) {
      return NextResponse.json({ error: "Staff not found." }, { status: 404 });
    }

    const allAppointments = staff.appointments;
    const monthAppointments = allAppointments.filter((item) => item.appointmentDate >= month.start && item.appointmentDate <= month.end);
    const weekAppointments = allAppointments.filter((item) => item.appointmentDate >= week.start && item.appointmentDate <= week.end);

    const attendancePresentCount = staff.attendances.filter((entry) => entry.status === "PRESENT" || entry.status === "HALF_DAY").length;
    const attendancePercentage = staff.attendances.length
      ? Math.round((attendancePresentCount / staff.attendances.length) * 100)
      : 0;

    const revenueGenerated = allAppointments.reduce((sum, item) => sum + Number(item.service.price), 0);

    const byCategory = allAppointments.reduce<Record<string, number>>((acc, item) => {
      const key = item.service.category;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      staff: {
        id: staff.id,
        name: staff.name,
        designation: staff.designation,
        mobile: staff.mobile,
        email: staff.email,
        status: staff.status,
        availabilityStatus: staff.availabilityStatus,
        workingDays: staff.workingDays,
        createdAt: staff.createdAt,
        stats: {
          totalAppointments: allAppointments.length,
          monthAppointments: monthAppointments.length,
          attendancePercentage,
          avgRating: Math.round((ratingAgg._avg.rating ?? 0) * 10) / 10,
          totalRatings: ratingAgg._count.rating,
        },
        scheduleWeek: weekAppointments.map((item) => ({
          id: item.id,
          appointmentDate: item.appointmentDate,
          appointmentTime: item.appointmentTime,
          customerName: item.customer.name,
          serviceName: item.service.name,
          status: item.status,
        })),
        attendanceMonth: staff.attendances.map((entry) => ({
          id: entry.id,
          date: entry.date,
          status: entry.status,
        })),
        performance: {
          servicesByCategory: byCategory,
          revenueGenerated,
          customerSatisfaction: ratingAgg._count.rating > 0
            ? `${Math.round((ratingAgg._avg.rating ?? 0) * 10) / 10} / 5 (${ratingAgg._count.rating} review${ratingAgg._count.rating === 1 ? "" : "s"})`
            : "No ratings yet",
        },
      },
    });
  } catch (error) {
    console.error("Staff fetch error:", { id, tenantId, error });

    return NextResponse.json({ error: "Failed to fetch staff member." }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await tenantIdOrNull();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = updateStaffSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid staff data." }, { status: 400 });
    }

    const payload = parsed.data;

    const updated = await prisma.staff.updateMany({
      where: {
        id,
        tenantId,
      },
      data: {
        name: payload.name,
        designation: payload.designation,
        mobile: payload.mobile === "" ? null : payload.mobile,
        email: payload.email === "" ? null : payload.email,
        workingDays: payload.workingDays,
        status: payload.status,
        availabilityStatus: payload.availabilityStatus,
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Staff not found." }, { status: 404 });
    }

    const staff = await prisma.staff.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    return NextResponse.json({ staff });
  } catch (error) {
    console.error("Failed to update staff", error);
    return NextResponse.json({ error: "Unable to update staff." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await tenantIdOrNull();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const appointmentCount = await prisma.appointment.count({
    where: {
      tenantId,
      staffId: id,
    },
  });

  if (appointmentCount > 0) {
    return NextResponse.json(
      {
        error: "Cannot delete staff with appointment history.",
      },
      { status: 409 },
    );
  }

  const deleted = await prisma.staff.deleteMany({
    where: {
      id,
      tenantId,
    },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Staff not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
