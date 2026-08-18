import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SERVICE_CATEGORIES } from "@/lib/utils";

const createSchema = z.object({
  name: z.string().trim().min(2, "Category name is required.").max(40, "Category name is too long."),
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
    let categories = await prisma.serviceCategory.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    if (categories.length === 0) {
      const existingNames = await prisma.service.findMany({
        where: { tenantId },
        distinct: ["category"],
        select: { category: true },
      });

      const seedNames = new Set<string>([
        ...DEFAULT_SERVICE_CATEGORIES,
        ...existingNames.map((item) => item.category).filter(Boolean),
      ]);

      await prisma.serviceCategory.createMany({
        data: [...seedNames].map((name) => ({ name, tenantId })),
        skipDuplicates: true,
      });

      categories = await prisma.serviceCategory.findMany({
        where: { tenantId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });
    }

    return NextResponse.json({ items: categories });
  } catch (error) {
    console.error("Failed to load service categories", error);
    return NextResponse.json({ error: "Unable to load categories." }, { status: 500 });
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
        { error: parsed.error.issues[0]?.message ?? "Invalid category." },
        { status: 400 },
      );
    }

    const existing = await prisma.serviceCategory.findFirst({
      where: { tenantId, name: { equals: parsed.data.name, mode: "insensitive" } },
      select: { id: true, name: true },
    });

    if (existing) {
      return NextResponse.json({ category: existing, alreadyExists: true });
    }

    const category = await prisma.serviceCategory.create({
      data: { name: parsed.data.name, tenantId },
      select: { id: true, name: true },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error("Failed to create service category", error);
    return NextResponse.json({ error: "Unable to create category." }, { status: 500 });
  }
}
