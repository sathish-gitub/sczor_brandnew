import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SERVICE_CATEGORIES } from "@/lib/utils";

const schema = z.object({
  salonName: z.string().trim().min(2, "Salon name is required."),
  mobile: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Mobile number must be 10 digits."),
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
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !session.user.needsOnboarding) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email.trim().toLowerCase();
  const name = session.user.name?.trim() || "Owner";

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid details." },
      { status: 400 },
    );
  }

  const { salonName, mobile } = parsed.data;

  try {
    const existingUser = await prisma.user.findFirst({ where: { email } });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account already exists with this email. Please login instead." },
        { status: 409 },
      );
    }

    const slug = buildTenantSlug(salonName);

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

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
        select: { id: true, slug: true },
      });

      const createdUser = await tx.user.create({
        data: {
          name,
          email,
          mobile,
          password: null,
          googleId: session.user.id,
          role: "OWNER",
          tenantId: createdTenant.id,
          emailVerified: true,
        },
        select: { id: true, role: true },
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

    return NextResponse.json({
      success: true,
      userId: user.id,
      role: user.role,
      tenantId: tenant.id,
      slug: tenant.slug,
    });
  } catch (error) {
    const prismaError = error as { message?: string; code?: string };
    console.error("Complete Google signup error:", error);

    if (prismaError.code === "P2002") {
      return NextResponse.json(
        { error: "An account already exists with this email." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Unable to create your salon. Please try again." },
      { status: 500 },
    );
  }
}
