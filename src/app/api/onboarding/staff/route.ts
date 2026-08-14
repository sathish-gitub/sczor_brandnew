import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const staffSchema = z.object({
  name: z.string().trim().min(2, "Staff name is required."),
  designation: z.enum([
    "Beautician",
    "Hair Stylist",
    "Nail Artist",
    "Makeup Artist",
    "Receptionist",
    "Manager",
  ]),
  mobile: z.string().trim().regex(/^\d{10}$/, "Mobile number must be 10 digits."),
});

const staffPayloadSchema = z.object({
  staff: z.array(staffSchema).min(1, "Add at least one staff member."),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = staffPayloadSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message ?? "Invalid staff payload." },
        { status: 400 },
      );
    }

    await prisma.staff.createMany({
      data: result.data.staff.map((member) => ({
        ...member,
        tenantId: session.user.tenantId,
      })),
    });

    return NextResponse.json({ success: true, count: result.data.staff.length });
  } catch (error) {
    console.error("Failed to save staff", error);

    return NextResponse.json(
      { error: "Unable to save staff right now." },
      { status: 500 },
    );
  }
}