import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

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

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);

  return slug || "salon";
}

async function resolveTenantSlug(salonName: string) {
  const baseSlug = slugify(salonName);
  let suffix = 0;

  while (true) {
    const slug = suffix === 0 ? baseSlug : `${baseSlug}-${suffix + 1}`;
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existingTenant) {
      return slug;
    }

    suffix += 1;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
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
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account already exists with this email." },
        { status: 409 },
      );
    }

    const slug = await resolveTenantSlug(salonName);
    const passwordHash = await hash(password, 12);

    const tenant = await prisma.$transaction(async (tx) => {
      const createdTenant = await tx.tenant.create({
        data: {
          name: salonName,
          slug,
          email,
          phone: mobile,
        },
        select: {
          id: true,
          slug: true,
        },
      });

      await tx.user.create({
        data: {
          name,
          email,
          mobile,
          password: passwordHash,
          role: "OWNER",
          tenantId: createdTenant.id,
        },
      });

      await tx.salonSettings.create({
        data: {
          tenantId: createdTenant.id,
        },
      });

      return createdTenant;
    });

    return NextResponse.json(
      {
        message: "Salon account created successfully.",
        tenantId: tenant.id,
        slug: tenant.slug,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Registration failed", error);

    return NextResponse.json(
      { error: "Unable to create your salon account right now." },
      { status: 500 },
    );
  }
}