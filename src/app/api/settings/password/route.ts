import { compare, hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z.string().min(6, "New password must be at least 6 characters."),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((input) => input.newPassword === input.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const isCurrentValid = await compare(parsed.data.currentPassword, user.password);
    if (!isCurrentValid) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }

    const passwordHash = await hash(parsed.data.newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: passwordHash },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to change password", error);
    return NextResponse.json({ error: "Unable to change password right now." }, { status: 500 });
  }
}
