import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  ownerName: z.string().trim().min(2, "Name is required."),
  email: z.string().trim().email("Invalid email."),
  mobile: z.string().trim().regex(/^\d{10}$/, "Mobile must be 10 digits."),
  profilePhoto: z.string().optional().or(z.literal("")),
});

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.id || !session.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
    }

    const data = parsed.data;

    const existingEmail = await prisma.user.findFirst({
      where: {
        id: { not: session.user.id },
        tenantId: session.user.tenantId,
        email: data.email,
      },
      select: { id: true },
    });

    if (existingEmail) {
      return NextResponse.json({ error: "Email already used by another team member." }, { status: 409 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: data.ownerName,
        email: data.email,
        mobile: data.mobile,
        photo: data.profilePhoto || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update account profile", error);
    return NextResponse.json({ error: "Unable to update account profile right now." }, { status: 500 });
  }
}
