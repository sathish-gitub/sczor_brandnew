import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { formatAppointmentId } from "@/lib/formatId";
import { checkWriteAccess } from "@/lib/enforceAccess";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  AppointmentConflictError,
  AppointmentValidationError,
  normalizeServiceLines,
  resolveServiceLineSnapshots,
  serviceLineSchema,
} from "@/lib/appointmentServicePayload";
import { assertNoStaffConflicts, loadStaffLineWindowsForDate } from "@/lib/appointmentLines";
import { istDayBounds, istMonthBounds, istWallTimeToInstant, istWeekBounds, todayISTDateString } from "@/lib/time";
import { getStaffDesignationName } from "@/lib/staffDesignation";

const appointmentStatusValues = [
  "BOOKED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "BILLED",
] as const;

const appointmentStatusSchema = z.enum(appointmentStatusValues);

const appointmentPayloadSchema = z.object({
  customerId: z.string().cuid().optional(),
  mobile: z.string().trim().regex(/^\d{10}$/, "Mobile number must be 10 digits."),
  customerName: z.string().trim().min(2, "Customer name is required."),
  email: z.string().trim().email("Invalid email address.").optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  appointmentTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  services: z.array(serviceLineSchema).optional(),
  // Legacy single-service shape, still accepted and converted to a one-line `services` array.
  serviceId: z.string().cuid().optional(),
  staffId: z.string().cuid().nullable().optional(),
  status: appointmentStatusSchema.default("BOOKED"),
});

function parseDateOnly(value: string) {
  return istWallTimeToInstant(value, "00:00");
}

function noStore(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

// Bounds are [start, end) - callers should filter with `lt: bounds.end`, not `lte`.
function periodBounds(period: string | null) {
  const todayStr = todayISTDateString();

  if (period === "this_week") {
    return istWeekBounds(todayStr);
  }

  if (period === "this_month") {
    return istMonthBounds(todayStr);
  }

  return istDayBounds(todayStr);
}

async function getSessionTenantId() {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return null;
  }

  return session.user.tenantId;
}

async function findOrCreateCustomer(
  tx: Prisma.TransactionClient,
  tenantId: string,
  payload: z.infer<typeof appointmentPayloadSchema>,
) {
  if (payload.customerId) {
    const existing = await tx.customer.findFirst({
      where: {
        id: payload.customerId,
        tenantId,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      return existing.id;
    }
  }

  const customer = await tx.customer.upsert({
    where: {
      mobile_tenantId: {
        mobile: payload.mobile,
        tenantId,
      },
    },
    update: {
      name: payload.customerName,
      email: payload.email || null,
      notes: payload.notes || null,
    },
    create: {
      tenantId,
      mobile: payload.mobile,
      name: payload.customerName,
      email: payload.email || null,
      notes: payload.notes || null,
    },
    select: {
      id: true,
    },
  });

  return customer.id;
}

export async function GET(request: Request) {
  const tenantId = await getSessionTenantId();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const mobile = url.searchParams.get("mobile")?.trim();

  if (mobile) {
    if (!/^\d{10}$/.test(mobile)) {
      return NextResponse.json({ customer: null });
    }

    const customer = await prisma.customer.findFirst({
      where: {
        tenantId,
        mobile,
      },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
      },
    });

    return NextResponse.json({ customer });
  }

  const period = url.searchParams.get("date");
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("q")?.trim();
  const page = Math.max(Number(url.searchParams.get("page") ?? "1"), 1);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "10"), 1), 50);

  const bounds = periodBounds(period);
  const statusFilter = status && appointmentStatusValues.includes(status as (typeof appointmentStatusValues)[number])
    ? (status as (typeof appointmentStatusValues)[number])
    : null;

  try {
    const where: Prisma.AppointmentWhereInput = {
      tenantId,
      appointmentDate: {
        gte: bounds.start,
        lt: bounds.end,
      },
      status: statusFilter ?? undefined,
      ...(search
        ? {
            OR: [
              { customer: { name: { contains: search, mode: "insensitive" } } },
              { customer: { mobile: { contains: search } } },
              { appointmentNumber: { contains: search, mode: "insensitive" } },
              { services: { some: { service: { name: { contains: search, mode: "insensitive" } } } } },
            ],
          }
        : {}),
    };

    const [total, appointments, filteredStats] = await Promise.all([
      prisma.appointment.count({ where }),
      prisma.appointment.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              mobile: true,
              email: true,
            },
          },
          services: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              duration: true,
              price: true,
              service: { select: { id: true, name: true } },
              staff: { select: { id: true, name: true, designation: true, designationId: true, staffDesignation: { select: { name: true } } } },
            },
          },
          invoice: { select: { id: true, invoiceNumber: true } },
        },
        orderBy: [{ appointmentDate: "desc" }, { appointmentTime: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      (async () => {
        // Count without status filter (so all cards show their full count)
        const countWhere: Prisma.AppointmentWhereInput = {
          tenantId,
          appointmentDate: {
            gte: bounds.start,
            lt: bounds.end,
          },
          ...(search
            ? {
                OR: [
                  { customer: { name: { contains: search, mode: "insensitive" } } },
                  { customer: { mobile: { contains: search } } },
                  { appointmentNumber: { contains: search, mode: "insensitive" } },
                  { services: { some: { service: { name: { contains: search, mode: "insensitive" } } } } },
                ],
              }
            : {}),
        };

        const total = await prisma.appointment.count({ where: countWhere });
        const booked = await prisma.appointment.count({
          where: { ...countWhere, status: "BOOKED" },
        });
        const inProgress = await prisma.appointment.count({
          where: { ...countWhere, status: "IN_PROGRESS" },
        });
        const completed = await prisma.appointment.count({
          where: { ...countWhere, status: "COMPLETED" },
        });
        const billed = await prisma.appointment.count({
          where: { ...countWhere, status: "BILLED" },
        });
        const cancelled = await prisma.appointment.count({
          where: { ...countWhere, status: "CANCELLED" },
        });

        return {
          total,
          booked,
          inProgress,
          completed,
          billed,
          cancelled,
        };
      })(),
    ]);

    const items = appointments.map((appointment) => ({
      ...appointment,
      services: appointment.services.map((line) => ({
        ...line,
        staff: line.staff
          ? {
              id: line.staff.id,
              name: line.staff.name,
              designation: getStaffDesignationName(line.staff),
            }
          : null,
      })),
    }));

    return noStore({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      stats: filteredStats,
    });
  } catch (error) {
    console.error("Failed to list appointments", error);

    return NextResponse.json(
      {
        error: "Unable to load appointments.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const tenantId = await getSessionTenantId();

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
    const parsed = appointmentPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Invalid appointment data.",
        },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    const appointmentDate = parseDateOnly(payload.appointmentDate);

    const rawLines = normalizeServiceLines(payload);
    const { lines, totalDuration, totalAmount, staffNameById } = await resolveServiceLineSnapshots(
      tenantId,
      rawLines,
    );

    const existingWindows = await loadStaffLineWindowsForDate({
      tenantId,
      dateStr: payload.appointmentDate,
    });

    assertNoStaffConflicts({
      appointmentDate,
      appointmentTime: payload.appointmentTime,
      lines,
      existingWindows,
      staffNameById,
    });

    const appointmentYear = Number(payload.appointmentDate.slice(0, 4));
    const firstLine = lines[0];

    const appointment = await prisma.$transaction(async (tx) => {
      const customerId = await findOrCreateCustomer(tx, tenantId, payload);

      // Use max(existing)+1 rather than a row count, so historical gaps
      // (e.g. from deleted records) can never collide with an already-used number.
      const lastForYear = await tx.appointment.findFirst({
        where: {
          tenantId,
          appointmentNumber: {
            startsWith: `SCZO-${appointmentYear}-`,
          },
        },
        orderBy: { appointmentNumber: "desc" },
        select: { appointmentNumber: true },
      });
      const lastSeq = lastForYear?.appointmentNumber
        ? Number(lastForYear.appointmentNumber.split("-").pop())
        : 0;

      return tx.appointment.create({
        data: {
          tenantId,
          customerId,
          serviceId: firstLine.serviceId,
          staffId: firstLine.staffId,
          appointmentNumber: formatAppointmentId(lastSeq + 1, appointmentYear),
          appointmentDate,
          appointmentTime: payload.appointmentTime,
          duration: totalDuration,
          totalAmount,
          status: payload.status,
          notes: payload.notes || null,
          services: {
            create: lines.map((line) => ({
              serviceId: line.serviceId,
              staffId: line.staffId,
              price: line.price,
              duration: line.duration,
              sortOrder: line.sortOrder,
              tenantId,
            })),
          },
        },
        include: {
          customer: true,
          service: true,
          staff: true,
          services: {
            orderBy: { sortOrder: "asc" },
            include: { service: true, staff: true },
          },
        },
      });
    });

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error) {
    if (error instanceof AppointmentConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (error instanceof AppointmentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Failed to create appointment", error);

    return NextResponse.json(
      {
        error: "Unable to create appointment.",
      },
      { status: 500 },
    );
  }
}
