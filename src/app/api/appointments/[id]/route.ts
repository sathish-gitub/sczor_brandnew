import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/enforceAccess";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { syncStaffAvailability } from "@/lib/staffAvailability";
import {
  AppointmentConflictError,
  AppointmentValidationError,
  normalizeServiceLines,
  resolveServiceLineSnapshots,
  serviceLineSchema,
} from "@/lib/appointmentServicePayload";
import { assertNoStaffConflicts, loadStaffLineWindowsForDate } from "@/lib/appointmentLines";
import { cancelBlockedMessage } from "@/lib/appointmentStatusActions";
import { istWallTimeToInstant } from "@/lib/time";

const appointmentInclude = {
  customer: true,
  service: true,
  staff: true,
  services: {
    orderBy: { sortOrder: "asc" as const },
    include: { service: true, staff: true },
  },
  invoice: { select: { id: true, invoiceNumber: true } },
} as const;

const appointmentStatusSchema = z.enum([
  "BOOKED",
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
  services: z.array(serviceLineSchema).optional(),
  // Legacy single-service shape, still accepted and converted to a one-line `services` array.
  serviceId: z.string().cuid().optional(),
  staffId: z.string().cuid().nullable().optional(),
  status: appointmentStatusSchema,
});

// Strict: a full edit payload would otherwise also match this and be treated as a status-only patch.
const patchPayloadSchema = z
  .object({
    status: appointmentStatusSchema,
  })
  .strict();

function parseDateOnly(value: string) {
  return istWallTimeToInstant(value, "00:00");
}

function noStore(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

async function getTenantId() {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return null;
  }

  return session.user.tenantId;
}

async function findOrCreateCustomer(
  tx: Prisma.TransactionClient,
  tenantId: string,
  payload: z.infer<typeof updatePayloadSchema>,
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
    include: appointmentInclude,
  });

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  }

  return noStore({ appointment });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getTenantId();

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

    const parsed = updatePayloadSchema.safeParse(body);

    if (!parsed.success) {
      const patchParsed = patchPayloadSchema.safeParse(body);

      if (patchParsed.success) {
        const existing = await prisma.appointment.findFirst({
          where: { id, tenantId },
          select: { staffId: true, status: true, services: { select: { staffId: true } } },
        });

        if (!existing) {
          return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
        }

        if (patchParsed.data.status === "CANCELLED") {
          const blockedMessage = cancelBlockedMessage(existing.status);

          if (blockedMessage) {
            return NextResponse.json({ error: blockedMessage }, { status: 400 });
          }
        }

        await prisma.appointment.update({
          where: { id },
          data: { status: patchParsed.data.status },
        });

        const staffIdsToSync = new Set(
          [existing.staffId, ...existing.services.map((line) => line.staffId)].filter(
            (value): value is string => Boolean(value),
          ),
        );
        // Run sequentially: concurrent queries from a single request have tripped a
        // driver-adapter/connection-pool race now that appointments can have several
        // distinct staff members to sync at once.
        for (const staffId of staffIdsToSync) {
          await syncStaffAvailability(tenantId, staffId);
        }

        const appointment = await prisma.appointment.findFirst({
          where: { id, tenantId },
          include: appointmentInclude,
        });

        return noStore({ appointment });
      }

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
      excludeAppointmentId: id,
    });

    assertNoStaffConflicts({
      appointmentDate,
      appointmentTime: payload.appointmentTime,
      lines,
      existingWindows,
      staffNameById,
    });

    const existing = await prisma.appointment.findFirst({
      where: { id, tenantId },
      select: { status: true, staffId: true, services: { select: { staffId: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
    }

    if (payload.status === "CANCELLED" && existing.status !== "CANCELLED") {
      const blockedMessage = cancelBlockedMessage(existing.status);

      if (blockedMessage) {
        return NextResponse.json({ error: blockedMessage }, { status: 400 });
      }
    }

    const firstLine = lines[0];

    await prisma.$transaction(async (tx) => {
      const customerId = await findOrCreateCustomer(tx, tenantId, payload);

      await tx.appointmentService.deleteMany({ where: { appointmentId: id } });

      await tx.appointment.update({
        where: { id },
        data: {
          customerId,
          serviceId: firstLine.serviceId,
          staffId: firstLine.staffId,
          appointmentDate,
          appointmentTime: payload.appointmentTime,
          duration: totalDuration,
          totalAmount,
          notes: payload.notes || null,
          status: payload.status,
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
      });
    });

    const previousStaffIds = [existing.staffId, ...existing.services.map((line) => line.staffId)].filter(
      (value): value is string => Boolean(value),
    );
    const newStaffIds = lines.map((line) => line.staffId).filter((value): value is string => Boolean(value));
    const staffIdsToSync = new Set([...previousStaffIds, ...newStaffIds]);
    // Run sequentially: concurrent queries from a single request have tripped a
    // driver-adapter/connection-pool race now that appointments can have several
    // distinct staff members to sync at once.
    for (const staffId of staffIdsToSync) {
      await syncStaffAvailability(tenantId, staffId);
    }

    const appointment = await prisma.appointment.findFirst({
      where: { id, tenantId },
      include: appointmentInclude,
    });

    return noStore({ appointment });
  } catch (error) {
    if (error instanceof AppointmentConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (error instanceof AppointmentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
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

  const existing = await prisma.appointment.findFirst({
    where: { id, tenantId },
    select: { staffId: true, status: true, services: { select: { staffId: true } } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  }

  const blockedMessage = cancelBlockedMessage(existing.status);

  if (blockedMessage) {
    return NextResponse.json({ error: blockedMessage }, { status: 400 });
  }

  await prisma.appointment.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  const staffIdsToSync = new Set(
    [existing.staffId, ...existing.services.map((line) => line.staffId)].filter(
      (value): value is string => Boolean(value),
    ),
  );
  // Run sequentially: concurrent queries from a single request have tripped a
  // driver-adapter/connection-pool race now that appointments can have several
  // distinct staff members to sync at once.
  for (const staffId of staffIdsToSync) {
    await syncStaffAvailability(tenantId, staffId);
  }

  return NextResponse.json({ success: true });
}
