import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const toggleSchema = z.object({
  isActive: z.boolean(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = toggleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { id: true } });

  if (!tenant) {
    return NextResponse.json({ error: "Salon not found" }, { status: 404 });
  }

  const updated = await prisma.tenant.update({
    where: { id },
    data: { isActive: parsed.data.isActive },
    select: { id: true, isActive: true },
  });

  return NextResponse.json({ salon: updated });
}
