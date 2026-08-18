import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateCustomerSchema = z.object({
  mobile: z.string().trim().regex(/^\d{10}$/).optional(),
  name: z.string().trim().min(2).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional().nullable(),
  dateOfBirth: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

async function getTenantId() {
  const session = await getServerSession(authOptions);
  if (!session?.user.tenantId) {
    return null;
  }

  return session.user.tenantId;
}

function parseDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  return new Date(`${value}T00:00:00`);
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getTenantId();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: {
      id,
      tenantId,
    },
    include: {
      loyaltyCard: {
        include: {
          transactions: {
            orderBy: {
              createdAt: "desc",
            },
            take: 50,
          },
        },
      },
      appointments: {
        include: {
          service: {
            select: {
              name: true,
            },
          },
          staff: {
            select: {
              name: true,
            },
          },
          invoice: {
            select: {
              total: true,
            },
          },
        },
        orderBy: [{ appointmentDate: "desc" }, { appointmentTime: "desc" }],
      },
      invoices: {
        orderBy: {
          invoiceDate: "desc",
        },
        include: {
          appointment: {
            include: {
              service: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  const totalVisits = customer.appointments.length;
  const totalSpent = Number(customer.loyaltyCard?.totalSpent ?? 0);

  const settings = await prisma.salonSettings.findUnique({
    where: { tenantId },
    select: { silverThreshold: true, goldThreshold: true, platinumThreshold: true },
  });

  return NextResponse.json({
    customer: {
      ...customer,
      totalVisits,
      totalSpent,
      loyaltyPoints: customer.loyaltyCard?.totalPoints ?? 0,
    },
    thresholds: {
      silverThreshold: settings?.silverThreshold ?? 500,
      goldThreshold: settings?.goldThreshold ?? 2000,
      platinumThreshold: settings?.platinumThreshold ?? 5000,
    },
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getTenantId();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = updateCustomerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Invalid customer data.",
        },
        { status: 400 },
      );
    }

    const payload = parsed.data;

    if (payload.mobile) {
      const existing = await prisma.customer.findFirst({
        where: {
          tenantId,
          mobile: payload.mobile,
          id: {
            not: id,
          },
        },
        select: {
          id: true,
        },
      });

      if (existing) {
        return NextResponse.json(
          {
            error: "A customer with this mobile number already exists.",
          },
          { status: 409 },
        );
      }
    }

    const updated = await prisma.customer.updateMany({
      where: {
        id,
        tenantId,
      },
      data: {
        mobile: payload.mobile,
        name: payload.name,
        email: payload.email === "" ? null : payload.email,
        gender: payload.gender,
        dateOfBirth: payload.dateOfBirth ? parseDate(payload.dateOfBirth) : undefined,
        notes: payload.notes === "" ? null : payload.notes,
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    }

    const customer = await prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        loyaltyCard: true,
      },
    });

    return NextResponse.json({ customer });
  } catch (error) {
    console.error("Failed to update customer", error);
    return NextResponse.json({ error: "Unable to update customer." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getTenantId();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const activeAppointments = await prisma.appointment.count({
      where: {
        tenantId,
        customerId: id,
        status: {
          in: ["BOOKED", "IN_PROGRESS"],
        },
      },
    });

    if (activeAppointments > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete customer with active appointments.",
        },
        { status: 409 },
      );
    }

    const deleted = await prisma.customer.deleteMany({
      where: {
        tenantId,
        id,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete customer", error);
    return NextResponse.json({ error: "Unable to delete customer." }, { status: 500 });
  }
}
