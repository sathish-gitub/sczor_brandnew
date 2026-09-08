import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { sendOTPEmail } from "@/lib/resend";
import { DEFAULT_SERVICE_CATEGORIES } from "@/lib/utils";

const registerSchema = z.object({
  salonName: z.string().trim().min(2, "Salon name is required."),
  name: z.string().trim().min(2, "Owner name is required."),
  email: z.email("Enter a valid email address.").transform((value) =>
    value.trim().toLowerCase(),
  ),
  mobile: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Mobile number must be 10 digits."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

function buildTenantSlug(salonName: string) {
  const base = salonName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  return `${base || "salon"}-${Date.now()}`;
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const raw = (body ?? {}) as Record<string, unknown>;

    if (!raw.salonName || !raw.name || !raw.email || !raw.mobile || !raw.password) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }

    const result = registerSchema.safeParse(body);

    if (!result.success) {
      const firstIssue = result.error.issues[0];

      return NextResponse.json(
        { error: firstIssue?.message ?? "Invalid registration details." },
        { status: 400 },
      );
    }

    const { salonName, name, email, mobile, password } = result.data;

    const existingUser = await prisma.user.findFirst({
      where: { email },
      select: { id: true, tenantId: true, emailVerified: true },
    });

    if (existingUser) {
      if (existingUser.emailVerified) {
        return NextResponse.json(
          { error: "An account already exists with this email. Please login instead." },
          { status: 409 },
        );
      }

      // Unverified signup abandoned - delete the incomplete tenant/user (cascades) and let them restart.
      await prisma.tenant.delete({ where: { id: existingUser.tenantId } });
    }

    const slug = buildTenantSlug(salonName);
    const passwordHash = await hash(password, 12);

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const emailOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    const { tenant, user } = await prisma.$transaction(async (tx) => {
      const createdTenant = await tx.tenant.create({
        data: {
          name: salonName,
          slug,
          email,
          phone: mobile,
          plan: "FREE_TRIAL",
          trialEndsAt,
          isActive: true,
          isSubscribed: false,
        },
        select: {
          id: true,
          slug: true,
        },
      });

      const createdUser = await tx.user.create({
        data: {
          name,
          email,
          mobile,
          password: passwordHash,
          role: "OWNER",
          tenantId: createdTenant.id,
          emailOtp: otp,
          emailOtpExpiry,
        },
        select: {
          id: true,
        },
      });

      await tx.salonSettings.create({
        data: {
          tenantId: createdTenant.id,
          gstEnabled: true,
          gstRate: 18,
          taxLabel: "GST",
          currency: "INR",
          currencySymbol: "₹",
          invoicePrefix: "INV",
          smsEnabled: false,
          whatsappEnabled: false,
          emailEnabled: false,
        },
      });

      await tx.serviceCategory.createMany({
        data: DEFAULT_SERVICE_CATEGORIES.map((categoryName) => ({
          name: categoryName,
          tenantId: createdTenant.id,
        })),
        skipDuplicates: true,
      });

      return { tenant: createdTenant, user: createdUser };
    });

    try {
      await sendOTPEmail(email, name, otp);
    } catch (emailError) {
      console.error("Failed to send OTP email:", emailError);
    }

    return NextResponse.json(
      {
        success: true,
        userId: user.id,
        email,
        tenantId: tenant.id,
        slug: tenant.slug,
        message: "OTP sent to your email",
      },
      { status: 201 },
    );
  } catch (error) {
    const prismaError = error as { message?: string; code?: string; meta?: unknown };

    console.error("Registration error full:", error);
    console.error("Error message:", prismaError.message);
    console.error("Error code:", prismaError.code);
    console.error("Error meta:", prismaError.meta);

    if (prismaError.code === "P2002") {
      return NextResponse.json(
        { error: "An account already exists with this email." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error: "Unable to create account. Please try again.",
        ...(process.env.NODE_ENV !== "production"
          ? { debug: { message: prismaError.message, code: prismaError.code } }
          : {}),
      },
      { status: 500 },
    );
  }
}