import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
