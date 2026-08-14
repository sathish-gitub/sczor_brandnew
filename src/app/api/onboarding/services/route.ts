import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const serviceSchema = z.object({
  name: z.string().trim().min(2, "Service name is required."),
  category: z.enum(["Hair", "Skin", "Nail", "Makeup", "Spa", "Other"]),
  price: z.coerce.number().positive("Price must be greater than zero."),
  duration: z.coerce.number().int().positive("Duration must be at least 1 minute."),
});

const servicesPayloadSchema = z.object({
  services: z.array(serviceSchema).min(1, "Add at least one service."),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = servicesPayloadSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message ?? "Invalid services payload." },
        { status: 400 },
      );
    }

    await prisma.service.createMany({
      data: result.data.services.map((service) => ({
        ...service,
        tenantId: session.user.tenantId,
      })),
    });

    return NextResponse.json({ success: true, count: result.data.services.length });
  } catch (error) {
    console.error("Failed to save services", error);

    return NextResponse.json(
      { error: "Unable to save services right now." },
      { status: 500 },
    );
  }
}