import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { email },
    select: { emailVerified: true },
  });

  return NextResponse.json({ verified: Boolean(user?.emailVerified) });
}
