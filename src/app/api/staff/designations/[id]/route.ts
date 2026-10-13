import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function tenantIdOrNull() {
  const session = await getServerSession(authOptions);
  return session?.user.tenantId ?? null;
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await tenantIdOrNull();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const designation = await prisma.staffDesignation.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });

  if (!designation) {
    return NextResponse.json({ error: "Designation not found." }, { status: 404 });
  }

  const staffCount = await prisma.staff.count({ where: { tenantId, designationId: id } });

  if (staffCount > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete - ${staffCount} staff member${staffCount === 1 ? "" : "s"} currently use${staffCount === 1 ? "s" : ""} this designation.`,
      },
      { status: 409 },
    );
  }

  await prisma.staffDesignation.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
