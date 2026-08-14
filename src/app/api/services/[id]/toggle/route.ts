import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function tenantIdOrNull() {
  const session = await getServerSession(authOptions);
  return session?.user.tenantId ?? null;
}

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    select: {
      id: true,
      status: true,
    },
  });

  if (!service) {
    return NextResponse.json({ error: "Service not found." }, { status: 404 });
  }

  const nextStatus = service.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  const updated = await prisma.service.update({
    where: {
      id: service.id,
    },
    data: {
      status: nextStatus,
    },
  });

  return NextResponse.json({
    service: {
      ...updated,
      price: Number(updated.price),
    },
  });
}
