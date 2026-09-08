import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const { userId, email, otp } = (body ?? {}) as { userId?: string; email?: string; otp?: string };

    if ((!userId && !email) || !otp) {
      return NextResponse.json({ error: "User ID or email, and OTP are required." }, { status: 400 });
    }

    const user = userId
      ? await prisma.user.findFirst({
          where: { id: userId },
          select: {
            id: true,
            emailVerified: true,
            emailOtp: true,
            emailOtpExpiry: true,
          },
        })
      : await prisma.user.findFirst({
          where: { email: email?.trim().toLowerCase() },
          select: {
            id: true,
            emailVerified: true,
            emailOtp: true,
            emailOtpExpiry: true,
          },
        });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ success: true });
    }

    if (user.emailOtp !== otp) {
      return NextResponse.json({ error: "Invalid OTP. Please try again." }, { status: 400 });
    }

    if (!user.emailOtpExpiry || user.emailOtpExpiry < new Date()) {
      return NextResponse.json(
        { error: "OTP has expired. Please request a new one." },
        { status: 400 },
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailOtp: null,
        emailOtpExpiry: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json({ error: "Verification failed." }, { status: 500 });
  }
}
