import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().trim().email("Invalid email."),
  plan: z.enum(["BASIC", "PRO"]),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
    }

    const data = parsed.data;

    await prisma.waitlistInterest.upsert({
      where: {
        tenantId_email_plan: {
          tenantId: session.user.tenantId,
          email: data.email,
          plan: data.plan,
        },
      },
      update: {},
      create: {
        tenantId: session.user.tenantId,
        email: data.email,
        plan: data.plan,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to add waitlist interest", error);
    return NextResponse.json({ error: "Unable to save waitlist request right now." }, { status: 500 });
  }
}
