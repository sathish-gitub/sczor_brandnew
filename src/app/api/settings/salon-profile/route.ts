import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  logo: z.string().optional().or(z.literal("")),
  salonName: z.string().trim().min(2, "Salon name is required."),
  tagline: z.string().optional().or(z.literal("")),
  phone: z.string().trim().regex(/^\d{10}$/, "Phone must be 10 digits."),
  email: z.string().trim().email("Invalid email.").optional().or(z.literal("")),
  website: z.string().trim().url("Invalid website URL.").optional().or(z.literal("")),
  gstNumber: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  state: z.string().optional().or(z.literal("")),
  pincode: z.string().regex(/^\d{6}$|^$/, "Pincode must be 6 digits.").optional().or(z.literal("")),
});

export async function PUT(request: Request) {
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

    await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: {
        logo: data.logo || null,
        name: data.salonName,
        tagline: data.tagline || null,
        phone: data.phone,
        email: data.email || null,
        website: data.website || null,
        gstNumber: data.gstNumber || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        pincode: data.pincode || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update salon profile", error);
    return NextResponse.json({ error: "Unable to update salon profile right now." }, { status: 500 });
  }
}
