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
  staff: z.array(z.unknown()).min(1, "Add at least one staff member."),
});

type StaffResult = {
  index: number;
  name: string;
  success: boolean;
  error?: string;
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const tenantId = session.user.tenantId;

  try {
    const body = await request.json();
    const payload = staffPayloadSchema.safeParse(body);

    if (!payload.success) {
      return NextResponse.json(
        { error: payload.error.issues[0]?.message ?? "Invalid staff payload." },
        { status: 400 },
      );
    }

    const results: StaffResult[] = [];

    for (const [index, raw] of payload.data.staff.entries()) {
      const parsed = staffSchema.safeParse(raw);
      const fallbackName =
        typeof raw === "object" && raw !== null && "name" in raw
          ? String((raw as { name?: unknown }).name ?? "")
          : "";

      if (!parsed.success) {
        results.push({
          index,
          name: fallbackName,
          success: false,
          error: parsed.error.issues[0]?.message ?? "Invalid staff details.",
        });
        continue;
      }

      try {
        await prisma.staff.create({
          data: {
            name: parsed.data.name,
            designation: parsed.data.designation,
            mobile: parsed.data.mobile,
            tenantId,
          },
        });

        results.push({ index, name: parsed.data.name, success: true });
      } catch (error) {
        console.error("Failed to create staff member", { index, error });
        results.push({
          index,
          name: parsed.data.name,
          success: false,
          error: "Could not save this staff member.",
        });
      }
    }

    const savedCount = results.filter((result) => result.success).length;
    const failed = results.filter((result) => !result.success);

    if (failed.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `${failed.length} of ${results.length} staff members could not be saved.`,
          count: savedCount,
          results,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, count: savedCount, results });
  } catch (error) {
    console.error("Failed to save staff", error);

    return NextResponse.json(
      { error: "Unable to save staff right now." },
      { status: 500 },
    );
  }
}