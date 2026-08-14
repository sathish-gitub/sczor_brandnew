import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().trim().min(2, "Name is required."),
  email: z.string().trim().email("Invalid email."),
  mobile: z.string().trim().regex(/^\d{10}$/, "Mobile must be 10 digits."),
  role: z.enum(["MANAGER", "STAFF"]),
});

function canManageTeam(role: string | undefined) {
  return role === "OWNER" || role === "MANAGER";
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId || !canManageTeam(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const users = await prisma.user.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        role: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      items: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        status: user.isActive ? "ACTIVE" : "INACTIVE",
      })),
    });
  } catch (error) {
    console.error("Failed to fetch team members", error);
    return NextResponse.json({ error: "Unable to fetch team members right now." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId || !canManageTeam(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
    }

    const data = parsed.data;

    const existing = await prisma.user.findFirst({
      where: {
        email: data.email,
        tenantId: session.user.tenantId,
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ error: "A team member already exists with this email." }, { status: 409 });
    }

    const temporaryPassword = `welcome${Math.floor(1000 + Math.random() * 9000)}`;
    const passwordHash = await hash(temporaryPassword, 12);

    const created = await prisma.user.create({
      data: {
        tenantId: session.user.tenantId,
        name: data.name,
        email: data.email,
        mobile: data.mobile,
        role: data.role,
        password: passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        role: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      invitationSent: true,
      temporaryPassword,
      item: {
        id: created.id,
        name: created.name,
        email: created.email,
        mobile: created.mobile,
        role: created.role,
        status: created.isActive ? "ACTIVE" : "INACTIVE",
      },
    });
  } catch (error) {
    console.error("Failed to add team member", error);
    return NextResponse.json({ error: "Unable to add team member right now." }, { status: 500 });
  }
}
