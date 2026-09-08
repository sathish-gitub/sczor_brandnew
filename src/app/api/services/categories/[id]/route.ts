import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const renameSchema = z.object({
  name: z.string().trim().min(2, "Category name is required.").max(40, "Category name is too long."),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const parsed = renameSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid category." },
        { status: 400 },
      );
    }

    const existing = await prisma.serviceCategory.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: { name: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }

    const duplicate = await prisma.serviceCategory.findFirst({
      where: {
        tenantId: session.user.tenantId,
        name: { equals: parsed.data.name, mode: "insensitive" },
        id: { not: id },
      },
      select: { id: true },
    });

    if (duplicate) {
      return NextResponse.json({ error: "A category with this name already exists." }, { status: 409 });
    }

    await prisma.service.updateMany({
      where: { tenantId: session.user.tenantId, category: existing.name },
      data: { category: parsed.data.name },
    });

    const category = await prisma.serviceCategory.update({
      where: { id },
      data: { name: parsed.data.name },
      select: { id: true, name: true },
    });

    return NextResponse.json({ category });
  } catch (error) {
    console.error("Failed to rename service category", error);
    return NextResponse.json({ error: "Unable to rename category." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const category = await prisma.serviceCategory.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: { name: true },
    });

    if (!category) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }

    const inUse = await prisma.service.count({
      where: { tenantId: session.user.tenantId, category: category.name },
    });

    if (inUse > 0) {
      return NextResponse.json(
        { error: `${inUse} service(s) still use this category.` },
        { status: 409 },
      );
    }

    await prisma.serviceCategory.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete service category", error);
    return NextResponse.json({ error: "Unable to delete category." }, { status: 500 });
  }
}
