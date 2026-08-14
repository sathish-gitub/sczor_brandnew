import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { formatAppointmentId } from "@/lib/formatId";
import { prisma } from "@/lib/prisma";

const appointmentStatusValues = [
  "BOOKED",
  "CONFIRMED",
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
  serviceId: z.string().cuid(),
  staffId: z.string().cuid(),
  duration: z.coerce.number().int().positive(),
  status: appointmentStatusSchema.default("BOOKED"),
});

function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00`);
}

function periodBounds(period: string | null) {
  const now = new Date();

  if (period === "this_week") {
    const day = now.getDay();
    const diffToMonday = (day + 6) % 7;
    const start = new Date(now);
    start.setDate(now.getDate() - diffToMonday);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  if (period === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

async function getSessionTenantId() {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return null;
  }

  return session.user.tenantId;
}

async function findOrCreateCustomer(tenantId: string, payload: z.infer<typeof appointmentPayloadSchema>) {
  if (payload.customerId) {
    const existing = await prisma.customer.findFirst({
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

  const customer = await prisma.customer.upsert({
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

async function ensureStaffNotDoubleBooked({
  tenantId,
  staffId,
  appointmentDate,
  appointmentTime,
  excludeAppointmentId,
}: {
  tenantId: string;
  staffId: string;
  appointmentDate: Date;
  appointmentTime: string;
  excludeAppointmentId?: string;
}) {
  const existing = await prisma.appointment.findFirst({
    where: {
      tenantId,
      staffId,
      appointmentDate,
      appointmentTime,
      status: {
        not: "CANCELLED",
      },
      id: excludeAppointmentId
        ? {
            not: excludeAppointmentId,
          }
        : undefined,
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    throw new Error("This staff member is already booked at the selected time.");
  }
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
  const page = Math.max(Number(url.searchParams.get("page") ?? "1"), 1);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "10"), 1), 50);

  const bounds = periodBounds(period);
  const statusFilter = status && appointmentStatusValues.includes(status as (typeof appointmentStatusValues)[number])
    ? (status as (typeof appointmentStatusValues)[number])
    : null;

  try {
    const where = {
      tenantId,
      appointmentDate: {
        gte: bounds.start,
        lte: bounds.end,
      },
      status: statusFilter ?? undefined,
    } as const;

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
          service: {
            select: {
              id: true,
              name: true,
            },
          },
          staff: {
            select: {
              id: true,
              name: true,
              designation: true,
            },
          },
        },
        orderBy: [{ appointmentDate: "desc" }, { appointmentTime: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      (async () => {
        const [total, booked, completed, cancelled] = await Promise.all([
          prisma.appointment.count({
            where,
          }),
          prisma.appointment.count({
            where: {
              ...where,
              status: "BOOKED",
            },
          }),
          prisma.appointment.count({
            where: {
              ...where,
              status: "COMPLETED",
            },
          }),
          prisma.appointment.count({
            where: {
              ...where,
              status: "CANCELLED",
            },
          }),
        ]);

        return {
          total,
          booked,
          completed,
          cancelled,
        };
      })(),
    ]);

    return NextResponse.json({
      items: appointments,
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

    await ensureStaffNotDoubleBooked({
      tenantId,
      staffId: payload.staffId,
      appointmentDate,
      appointmentTime: payload.appointmentTime,
    });

    const customerId = await findOrCreateCustomer(tenantId, payload);

    const appointmentYear = appointmentDate.getFullYear();
    const countForYear = await prisma.appointment.count({
      where: {
        tenantId,
        appointmentNumber: {
          startsWith: `SCZO-${appointmentYear}-`,
        },
      },
    });

    const appointment = await prisma.appointment.create({
      data: {
        tenantId,
        customerId,
        serviceId: payload.serviceId,
        staffId: payload.staffId,
        appointmentNumber: formatAppointmentId(countForYear + 1, appointmentYear),
        appointmentDate,
        appointmentTime: payload.appointmentTime,
        duration: payload.duration,
        status: payload.status,
        notes: payload.notes || null,
      },
      include: {
        customer: true,
        service: true,
        staff: true,
      },
    });

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("already booked")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
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
