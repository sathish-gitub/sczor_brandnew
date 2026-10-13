import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_STAFF_DESIGNATIONS } from "@/lib/utils";

const createSchema = z.object({
  name: z.string().trim().min(2, "Designation name is required.").max(40, "Designation name is too long."),
});

async function tenantIdOrNull() {
  const session = await getServerSession(authOptions);
  return session?.user.tenantId ?? null;
}

export async function GET() {
  const tenantId = await tenantIdOrNull();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let designations = await prisma.staffDesignation.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    if (designations.length === 0) {
      const existingNames = await prisma.staff.findMany({
        where: { tenantId },
        distinct: ["designation"],
        select: { designation: true },
      });

      const seedNames = new Set<string>([
        ...DEFAULT_STAFF_DESIGNATIONS,
        ...existingNames.map((item) => item.designation).filter(Boolean),
      ]);

      await prisma.staffDesignation.createMany({
        data: [...seedNames].map((name) => ({ name, tenantId })),
        skipDuplicates: true,
      });

      designations = await prisma.staffDesignation.findMany({
        where: { tenantId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });
    }

    return NextResponse.json({ items: designations });
  } catch (error) {
    console.error("Failed to load staff designations", error);
    return NextResponse.json({ error: "Unable to load designations." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const tenantId = await tenantIdOrNull();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = createSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid designation." },
        { status: 400 },
      );
    }

    const existing = await prisma.staffDesignation.findFirst({
      where: { tenantId, name: { equals: parsed.data.name, mode: "insensitive" } },
      select: { id: true, name: true },
    });

    if (existing) {
      return NextResponse.json({ designation: existing, alreadyExists: true });
    }

    const designation = await prisma.staffDesignation.create({
      data: { name: parsed.data.name, tenantId },
      select: { id: true, name: true },
    });

    return NextResponse.json({ designation }, { status: 201 });
  } catch (error) {
    console.error("Failed to create staff designation", error);
    return NextResponse.json({ error: "Unable to create designation." }, { status: 500 });
  }
}
