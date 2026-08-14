import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const appointmentStatusSchema = z.enum([
  "BOOKED",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "BILLED",
]);

const updatePayloadSchema = z.object({
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
  status: appointmentStatusSchema,
});

const patchPayloadSchema = z.object({
  status: appointmentStatusSchema,
});

function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00`);
}

async function getTenantId() {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return null;
  }

  return session.user.tenantId;
}

async function findOrCreateCustomer(tenantId: string, payload: z.infer<typeof updatePayloadSchema>) {
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
  appointmentId,
}: {
  tenantId: string;
  staffId: string;
  appointmentDate: Date;
  appointmentTime: string;
  appointmentId: string;
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
      id: {
        not: appointmentId,
      },
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    throw new Error("This staff member is already booked at the selected time.");
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getTenantId();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const appointment = await prisma.appointment.findFirst({
    where: {
      id,
      tenantId,
    },
    include: {
      customer: true,
      service: true,
      staff: true,
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
        },
      },
    },
  });

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  }

  return NextResponse.json({ appointment });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getTenantId();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();

    const patchParsed = patchPayloadSchema.safeParse(body);

    if (patchParsed.success) {
      const updated = await prisma.appointment.updateMany({
        where: {
          id,
          tenantId,
        },
        data: {
          status: patchParsed.data.status,
        },
      });

      if (updated.count === 0) {
        return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
      }

      const appointment = await prisma.appointment.findFirst({
        where: { id, tenantId },
        include: { customer: true, service: true, staff: true },
      });

      return NextResponse.json({ appointment });
    }

    const parsed = updatePayloadSchema.safeParse(body);

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
      appointmentId: id,
    });

    const customerId = await findOrCreateCustomer(tenantId, payload);

    const updated = await prisma.appointment.updateMany({
      where: {
        id,
        tenantId,
      },
      data: {
        customerId,
        serviceId: payload.serviceId,
        staffId: payload.staffId,
        appointmentDate,
        appointmentTime: payload.appointmentTime,
        duration: payload.duration,
        notes: payload.notes || null,
        status: payload.status,
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
    }

    const appointment = await prisma.appointment.findFirst({
      where: { id, tenantId },
      include: { customer: true, service: true, staff: true },
    });

    return NextResponse.json({ appointment });
  } catch (error) {
    if (error instanceof Error && error.message.includes("already booked")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error("Failed to update appointment", error);

    return NextResponse.json(
      {
        error: "Unable to update appointment.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getTenantId();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const result = await prisma.appointment.updateMany({
    where: {
      id,
      tenantId,
    },
    data: {
      status: "CANCELLED",
    },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
