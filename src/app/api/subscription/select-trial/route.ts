import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.tenantId || session.user.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data: {
      plan: "FREE_TRIAL",
      trialEndsAt,
    },
  });

  return NextResponse.json({ success: true });
}
