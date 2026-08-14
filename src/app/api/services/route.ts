import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createServiceSchema = z.object({
  name: z.string().trim().min(2, "Service name is required."),
  category: z.enum(["Hair", "Skin", "Nail", "Makeup", "Spa", "Other"]),
  description: z.string().optional().or(z.literal("")),
  price: z.coerce.number().positive("Price must be greater than zero."),
  duration: z.coerce.number().int().positive("Duration is required."),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

async function tenantIdOrNull() {
  const session = await getServerSession(authOptions);
  return session?.user.tenantId ?? null;
}

export async function GET(request: Request) {
  const tenantId = await tenantIdOrNull();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const category = url.searchParams.get("category")?.trim();

  const where = {
    tenantId,
    category: category && category !== "ALL" ? category : undefined,
  };

  try {
    const services = await prisma.service.findMany({
      where,
      orderBy: [{ status: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({
      items: services.map((service) => ({
        ...service,
        price: Number(service.price),
      })),
    });
  } catch (error) {
    console.error("Failed to list services", error);
    return NextResponse.json({ error: "Unable to load services." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const tenantId = await tenantIdOrNull();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createServiceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid service data." },
        { status: 400 },
      );
    }

    const payload = parsed.data;

    const service = await prisma.service.create({
      data: {
        tenantId,
        name: payload.name,
        category: payload.category,
        description: payload.description || null,
        price: payload.price,
        duration: payload.duration,
        status: payload.status,
      },
    });

    return NextResponse.json(
      {
        service: {
          ...service,
          price: Number(service.price),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create service", error);
    return NextResponse.json({ error: "Unable to create service." }, { status: 500 });
  }
}
