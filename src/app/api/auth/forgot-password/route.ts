import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/resend";

const schema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
});

const GENERIC_MESSAGE = "If an account exists for this email, a reset code has been sent.";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const { email } = parsed.data;

  try {
    const user = await prisma.user.findFirst({
      where: { email },
      select: { id: true, name: true, email: true },
    });

    // Don't reveal whether the email exists - always respond with the generic message.
    if (user) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const resetOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: { resetOtp: otp, resetOtpExpiry },
      });

      try {
        await sendPasswordResetEmail(user.email, user.name, otp);
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError);
      }
    }

    return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
  }
}
