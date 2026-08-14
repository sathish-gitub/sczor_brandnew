import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function canManageTeam(role: string | undefined) {
  return role === "OWNER" || role === "MANAGER";
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId || !canManageTeam(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await context.params;

    if (id === session.user.id) {
      return NextResponse.json({ error: "You cannot remove your own account." }, { status: 400 });
    }

    const member = await prisma.user.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Team member not found." }, { status: 404 });
    }

    if (member.role === "OWNER") {
      return NextResponse.json({ error: "Owner account cannot be removed." }, { status: 400 });
    }

    await prisma.user.delete({ where: { id: member.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove team member", error);
    return NextResponse.json({ error: "Unable to remove team member right now." }, { status: 500 });
  }
}
