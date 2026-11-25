import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/enforceAccess";
import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/payrollProration";
import { getStaffDesignationName } from "@/lib/staffDesignation";
import { getServicesDoneByInvoiceLine, getStaffRevenue } from "@/lib/staffRevenue";
import {
  currentISTMonthYear,
  daysInMonthIST,
  formatISTDateShort,
  getISTAgeYears,
  getISTMonth,
  getISTYear,
  istMonthBounds,
  istWallTimeToInstant,
  istWeekBounds,
  todayISTDateString,
  toISTDateString,
} from "@/lib/time";

const dateOnlyString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date.");

const updateStaffSchema = z.object({
  name: z.string().trim().min(2).optional(),
  designationId: z.string().min(1).optional(),
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

type MonthlySalaryRow = {
  effectiveFrom: string;
  effectiveTo: string;
  baseSalary: number | null;
  commission: number | null;
  total: number | null;
  payslipId: string | null;
};

/**
 * One row per calendar month from the staff member's joining month (falling
 * back to the earliest SalaryHistory.effectiveFrom, then the staff record's
 * createdAt) through the current IST month, newest first. Amounts come from
 * the Payroll record generated for that staff/month/year, if any:
 * baseSalary = grossPay - commissionAmount (the base actually paid that
 * month, prorated if applicable - equal to the full configured base salary
 * for older payslips generated before proration existed), commission =
 * commissionAmount, total = grossPay (base + commission; deductions are
 * intentionally excluded, see the payslip for net pay). Months with no
 * Payroll row are returned with null amounts ("Not Generated" in the UI).
 */
function buildMonthlySalaryHistory(params: {
  joiningDate: Date | null;
  createdAt: Date;
  earliestSalaryHistoryEffectiveFrom: Date | null;
  payrolls: Array<{ id: string; month: number; year: number; commissionAmount: unknown; grossPay: unknown }>;
}): MonthlySalaryRow[] {
  const { joiningDate, createdAt, earliestSalaryHistoryEffectiveFrom, payrolls } = params;

  const startDate = joiningDate ?? earliestSalaryHistoryEffectiveFrom ?? createdAt;
  const startYear = getISTYear(startDate);
  const startMonth = getISTMonth(startDate);
  const { year: currentYear, month: currentMonth } = currentISTMonthYear();

  const payrollByMonth = new Map(payrolls.map((payroll) => [`${payroll.year}-${payroll.month}`, payroll]));

  const rows: MonthlySalaryRow[] = [];
  let year = startYear;
  let month = startMonth;

  while (year < currentYear || (year === currentYear && month <= currentMonth)) {
    const padded = String(month).padStart(2, "0");
    const lastDay = daysInMonthIST(year, month);
    const effectiveFrom = formatISTDateShort(istWallTimeToInstant(`${year}-${padded}-01`, "00:00"));
    const effectiveTo = formatISTDateShort(istWallTimeToInstant(`${year}-${padded}-${String(lastDay).padStart(2, "0")}`, "00:00"));

    const payroll = payrollByMonth.get(`${year}-${month}`);
    const commission = payroll ? roundMoney(Number(payroll.commissionAmount)) : null;
    const total = payroll ? roundMoney(Number(payroll.grossPay)) : null;
    const baseSalary = payroll ? roundMoney(total! - commission!) : null;

    rows.push({
      effectiveFrom,
      effectiveTo,
      baseSalary,
      commission,
      total,
      payslipId: payroll?.id ?? null,
    });

    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return rows.reverse();
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

    const [staff, ratingAgg, allServicesDoneMap, monthServicesDoneMap, revenueAllTime, payrolls] = await Promise.all([
      prisma.staff.findFirst({
        where: { id, tenantId },
        include: {
          staffDesignation: { select: { id: true, name: true } },
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
      // "Services done" counts billing-line InvoiceItem service rows (POS
      // data), not appointment lines - see getServicesDoneByInvoiceLine, the
      // same basis as the Performance tab's category breakdown, so the two
      // never disagree. All-time and this-month respectively.
      getServicesDoneByInvoiceLine(tenantId, [id]),
      getServicesDoneByInvoiceLine(tenantId, [id], { gte: month.start, lt: month.end }),
      // Revenue is attributed per invoice LINE (InvoiceItem.staffId), the
      // same basis as the staff report, payroll and dashboard chart.
      getStaffRevenue(tenantId, id),
      prisma.payroll.findMany({
        where: { staffId: id, tenantId },
        select: { id: true, month: true, year: true, commissionAmount: true, grossPay: true },
        orderBy: [{ year: "asc" }, { month: "asc" }],
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

    const earliestSalaryHistoryEffectiveFrom = staff.salaryHistory.length
      ? staff.salaryHistory.reduce((earliest, entry) => (entry.effectiveFrom < earliest ? entry.effectiveFrom : earliest), staff.salaryHistory[0].effectiveFrom)
      : null;

    const monthlySalaryHistory = buildMonthlySalaryHistory({
      joiningDate: staff.joiningDate,
      createdAt: staff.createdAt,
      earliestSalaryHistoryEffectiveFrom,
      payrolls,
    });

    return NextResponse.json({
      staff: {
        id: staff.id,
        name: staff.name,
        designation: getStaffDesignationName(staff),
        designationId: staff.designationId,
        mobile: staff.mobile,
        email: staff.email,
        status: staff.status,
        availabilityStatus: staff.availabilityStatus,
        workingDays: staff.workingDays,
        createdAt: staff.createdAt,
        dateOfBirth: staff.dateOfBirth,
        joiningDate: staff.joiningDate,
        experienceYears: staff.experienceYears === null ? null : Number(staff.experienceYears),
        specializations: staff.specializations,
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
        salaryHistoryMonthly: monthlySalaryHistory,
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

    const dobOrJoiningError = validateDobAndJoining(payload.dateOfBirth, payload.joiningDate);
    if (dobOrJoiningError) {
      return NextResponse.json({ error: dobOrJoiningError }, { status: 400 });
    }

    let designationUpdate: { designation: string; designationId: string } | undefined;
    if (payload.designationId !== undefined) {
      const designation = await prisma.staffDesignation.findFirst({
        where: { id: payload.designationId, tenantId },
        select: { id: true, name: true },
      });

      if (!designation) {
        return NextResponse.json({ error: "Select a valid designation." }, { status: 400 });
      }

      designationUpdate = { designation: designation.name, designationId: designation.id };
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
          ...designationUpdate,
          mobile: payload.mobile === "" ? null : payload.mobile,
          email: payload.email === "" ? null : payload.email,
          workingDays: payload.workingDays,
          status: payload.status,
          availabilityStatus: payload.availabilityStatus,
          baseSalary: payload.baseSalary,
          commissionRate: payload.commissionRate,
          paidLeavesPerMonth: payload.paidLeavesPerMonth,
          salaryEffectiveFrom: salaryChanged ? today : undefined,
          dateOfBirth: payload.dateOfBirth === undefined ? undefined : (payload.dateOfBirth ? istWallTimeToInstant(payload.dateOfBirth, "00:00") : null),
          joiningDate: payload.joiningDate === undefined ? undefined : (payload.joiningDate ? istWallTimeToInstant(payload.joiningDate, "00:00") : null),
          experienceYears: payload.experienceYears,
          specializations: payload.specializations,
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
