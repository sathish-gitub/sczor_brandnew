import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/enforceAccess";
import { prisma } from "@/lib/prisma";
import { getServicesDoneByStaff, getStaffRevenue } from "@/lib/staffRevenue";
import { istMonthBounds, istWeekBounds, todayISTDateString } from "@/lib/time";

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
  baseSalary: z.number().nonnegative().nullable().optional(),
  commissionRate: z.number().min(0).max(100).nullable().optional(),
  paidLeavesPerMonth: z.number().int().min(0).nullable().optional(),
});

async function tenantIdOrNull() {
  const session = await getServerSession(authOptions);
  return session?.user.tenantId ?? null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await tenantIdOrNull();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const today = todayISTDateString();
  const month = istMonthBounds(today);
  const week = istWeekBounds(today);

  try {

    const [staff, ratingAgg, allServicesDoneMap, monthServicesDoneMap, revenueAllTime, categoryLines] = await Promise.all([
      prisma.staff.findFirst({
        where: { id, tenantId },
        include: {
          appointments: {
            orderBy: [{ appointmentDate: "desc" }, { appointmentTime: "asc" }],
            include: {
              customer: { select: { name: true } },
              service: { select: { name: true, category: true, price: true } },
            },
          },
          attendances: {
            where: { date: { gte: month.start, lt: month.end } },
            orderBy: { date: "asc" },
          },
          salaryHistory: {
            orderBy: { effectiveFrom: "desc" },
          },
        },
      }),
      prisma.staffRating.aggregate({
        where: { staffId: id },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      // "Services done" counts AppointmentService lines, not appointments
      // (the same person on two lines of one appointment counts twice).
      // All-time, all statuses - matches the previous mirror-based scope.
      getServicesDoneByStaff(tenantId, [id]),
      getServicesDoneByStaff(tenantId, [id], { gte: month.start, lt: month.end }),
      // Revenue is attributed per invoice LINE (InvoiceItem.staffId), the
      // same basis as the staff report, payroll and dashboard chart.
      getStaffRevenue(tenantId, id),
      prisma.appointmentService.findMany({
        where: { tenantId, staffId: id },
        select: { service: { select: { category: true } } },
      }),
    ]);

    if (!staff) {
      return NextResponse.json({ error: "Staff not found." }, { status: 404 });
    }

    const allAppointments = staff.appointments;
    const weekAppointments = allAppointments.filter((item) => item.appointmentDate >= week.start && item.appointmentDate < week.end);

    const attendancePresentCount = staff.attendances.filter((entry) => entry.status === "PRESENT" || entry.status === "HALF_DAY").length;
    const attendancePercentage = staff.attendances.length
      ? Math.round((attendancePresentCount / staff.attendances.length) * 100)
      : 0;

    const revenueGenerated = revenueAllTime.revenue;
    const servicesDone = allServicesDoneMap.get(id)?.count ?? 0;
    const servicesDoneThisMonth = monthServicesDoneMap.get(id)?.count ?? 0;

    const byCategory = categoryLines.reduce<Record<string, number>>((acc, line) => {
      const key = line.service.category;
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
        baseSalary: staff.baseSalary === null ? null : Number(staff.baseSalary),
        commissionRate: staff.commissionRate === null ? null : Number(staff.commissionRate),
        paidLeavesPerMonth: staff.paidLeavesPerMonth,
        salaryEffectiveFrom: staff.salaryEffectiveFrom,
        salaryHistory: staff.salaryHistory.map((entry) => ({
          id: entry.id,
          baseSalary: Number(entry.baseSalary),
          commissionRate: Number(entry.commissionRate),
          paidLeavesPerMonth: entry.paidLeavesPerMonth,
          effectiveFrom: entry.effectiveFrom,
          effectiveTo: entry.effectiveTo,
        })),
        stats: {
          servicesDone,
          servicesDoneThisMonth,
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

  const access = await checkWriteAccess(tenantId);
  if (!access.allowed) {
    return NextResponse.json(
      { error: "SUBSCRIPTION_REQUIRED", message: access.reason },
      { status: 403 },
    );
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = updateStaffSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid staff data." }, { status: 400 });
    }

    const payload = parsed.data;

    const existing = await prisma.staff.findFirst({
      where: { id, tenantId },
      select: { baseSalary: true, commissionRate: true, paidLeavesPerMonth: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Staff not found." }, { status: 404 });
    }

    const currentBaseSalary = existing.baseSalary === null ? null : Number(existing.baseSalary);
    const currentCommissionRate = existing.commissionRate === null ? null : Number(existing.commissionRate);
    const currentPaidLeavesPerMonth = existing.paidLeavesPerMonth;
    const nextBaseSalary = payload.baseSalary !== undefined ? payload.baseSalary : currentBaseSalary;
    const nextCommissionRate = payload.commissionRate !== undefined ? payload.commissionRate : currentCommissionRate;
    const nextPaidLeavesPerMonth =
      payload.paidLeavesPerMonth !== undefined ? payload.paidLeavesPerMonth : currentPaidLeavesPerMonth;

    const salaryProvided =
      payload.baseSalary !== undefined || payload.commissionRate !== undefined || payload.paidLeavesPerMonth !== undefined;
    const salaryChanged =
      salaryProvided &&
      nextBaseSalary !== null &&
      nextCommissionRate !== null &&
      (nextBaseSalary !== currentBaseSalary ||
        nextCommissionRate !== currentCommissionRate ||
        nextPaidLeavesPerMonth !== currentPaidLeavesPerMonth);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.staff.updateMany({
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
          baseSalary: payload.baseSalary,
          commissionRate: payload.commissionRate,
          paidLeavesPerMonth: payload.paidLeavesPerMonth,
          salaryEffectiveFrom: salaryChanged ? today : undefined,
        },
      });

      if (salaryChanged && result.count > 0) {
        await tx.salaryHistory.updateMany({
          where: { staffId: id, tenantId, effectiveTo: null },
          data: { effectiveTo: today },
        });

        await tx.salaryHistory.create({
          data: {
            staffId: id,
            tenantId,
            baseSalary: nextBaseSalary,
            commissionRate: nextCommissionRate,
            paidLeavesPerMonth: nextPaidLeavesPerMonth,
            effectiveFrom: today,
          },
        });
      }

      return result;
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

  // Check both the mirror field (first line) and AppointmentService lines, since a
  // staff member can now have history on a non-first line only.
  const [appointmentCount, appointmentServiceCount] = await Promise.all([
    prisma.appointment.count({
      where: {
        tenantId,
        staffId: id,
      },
    }),
    prisma.appointmentService.count({
      where: {
        tenantId,
        staffId: id,
      },
    }),
  ]);

  if (appointmentCount > 0 || appointmentServiceCount > 0) {
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
