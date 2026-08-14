import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateServiceSchema = z.object({
  name: z.string().trim().min(2).optional(),
  category: z.enum(["Hair", "Skin", "Nail", "Makeup", "Spa", "Other"]).optional(),
  description: z.string().optional().or(z.literal("")),
  price: z.coerce.number().positive().optional(),
  duration: z.coerce.number().int().positive().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
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

  const service = await prisma.service.findFirst({
    where: {
      id,
      tenantId,
    },
  });

  if (!service) {
    return NextResponse.json({ error: "Service not found." }, { status: 404 });
  }

  return NextResponse.json({
    service: {
      ...service,
      price: Number(service.price),
    },
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await tenantIdOrNull();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = updateServiceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid service data." }, { status: 400 });
    }

    const payload = parsed.data;

    const updated = await prisma.service.updateMany({
      where: {
        id,
        tenantId,
      },
      data: {
        name: payload.name,
        category: payload.category,
        description: payload.description === "" ? null : payload.description,
        price: payload.price,
        duration: payload.duration,
        status: payload.status,
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Service not found." }, { status: 404 });
    }

    const service = await prisma.service.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    return NextResponse.json({
      service: service
        ? {
            ...service,
            price: Number(service.price),
          }
        : null,
    });
  } catch (error) {
    console.error("Failed to update service", error);
    return NextResponse.json({ error: "Unable to update service." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await tenantIdOrNull();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const usageCount = await prisma.appointment.count({
      where: {
        tenantId,
        serviceId: id,
        status: {
          in: ["BOOKED", "CONFIRMED", "IN_PROGRESS"],
        },
      },
    });

    if (usageCount > 0) {
      return NextResponse.json({ error: "Cannot delete service with active appointments." }, { status: 409 });
    }

    const deleted = await prisma.service.deleteMany({
      where: {
        id,
        tenantId,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Service not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete service", error);
    return NextResponse.json({ error: "Unable to delete service." }, { status: 500 });
  }
}
