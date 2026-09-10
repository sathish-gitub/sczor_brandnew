import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { checkRateLimit, recordAttempt } from "@/lib/rateLimit";

const schema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  otp: z.string().length(6, "Enter the complete 6-digit code."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json({ error: firstIssue?.message ?? "Invalid request." }, { status: 400 });
  }

  const { email, otp, password } = parsed.data;

  try {
    const user = await prisma.user.findFirst({
      where: { email },
      select: { id: true, resetOtp: true, resetOtpExpiry: true },
    });

    if (!user || !user.resetOtp) {
      return NextResponse.json({ error: "Invalid or expired OTP. Please try again." }, { status: 400 });
    }

    const rateLimitCheck = await checkRateLimit(email, "PASSWORD_RESET");
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        { error: `Too many attempts. Please try again in ${rateLimitCheck.retryAfterMinutes} minutes.` },
        { status: 429 },
      );
    }

    if (user.resetOtp !== otp) {
      await recordAttempt(email, "PASSWORD_RESET");
      return NextResponse.json({ error: "Invalid OTP. Please try again." }, { status: 400 });
    }

    if (!user.resetOtpExpiry || user.resetOtpExpiry < new Date()) {
      return NextResponse.json(
        { error: "OTP has expired. Please request a new one." },
        { status: 400 },
      );
    }

    const passwordHash = await hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: passwordHash,
        resetOtp: null,
        resetOtpExpiry: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Unable to reset password. Please try again." }, { status: 500 });
  }
}
