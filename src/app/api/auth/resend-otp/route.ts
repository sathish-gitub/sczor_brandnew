import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendOTPEmail } from "@/lib/resend";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const { userId, email } = (body ?? {}) as { userId?: string; email?: string };

    if (!userId && !email) {
      return NextResponse.json({ error: "User ID or email is required." }, { status: 400 });
    }

    const user = userId
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, email: true, emailVerified: true },
        })
      : await prisma.user.findFirst({
          where: { email: email?.trim().toLowerCase() },
          select: { id: true, name: true, email: true, emailVerified: true },
        });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ error: "Email is already verified." }, { status: 400 });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const emailOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { emailOtp: otp, emailOtpExpiry },
    });

    await sendOTPEmail(user.email, user.name, otp);

    return NextResponse.json({ success: true, userId: user.id });
  } catch (error) {
    console.error("Resend OTP error:", error);
    return NextResponse.json({ error: "Unable to resend OTP." }, { status: 500 });
  }
}
