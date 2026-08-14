import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createCustomerSchema = z.object({
  mobile: z.string().trim().regex(/^\d{10}$/, "Mobile number must be 10 digits."),
  name: z.string().trim().min(2, "Customer name is required."),
  email: z.string().trim().email("Invalid email.").optional().or(z.literal("")),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  dateOfBirth: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

async function getTenantId() {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return null;
  }

  return session.user.tenantId;
}

function parseDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  return new Date(`${value}T00:00:00`);
}

export async function GET(request: Request) {
  const tenantId = await getTenantId();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const page = Math.max(Number(url.searchParams.get("page") ?? "1"), 1);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "20"), 1), 100);

  const where = {
    tenantId,
    OR: search
      ? [
          {
            name: {
              contains: search,
              mode: "insensitive" as const,
            },
          },
          {
            mobile: {
              contains: search,
            },
          },
        ]
      : undefined,
  };

  try {
    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          loyaltyCard: {
            select: {
              tier: true,
              totalSpent: true,
            },
          },
          appointments: {
            select: {
              id: true,
              appointmentDate: true,
            },
            orderBy: {
              appointmentDate: "desc",
            },
          },
        },
      }),
    ]);

    const items = customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      mobile: customer.mobile,
      email: customer.email,
      loyaltyTier: customer.loyaltyCard?.tier ?? "BRONZE",
      totalSpent: Number(customer.loyaltyCard?.totalSpent ?? 0),
      totalVisits: customer.appointments.length,
      lastVisit: customer.appointments[0]?.appointmentDate ?? null,
      createdAt: customer.createdAt,
    }));

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error("Failed to list customers", error);
    return NextResponse.json({ error: "Unable to load customers." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const tenantId = await getTenantId();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createCustomerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Invalid customer data.",
        },
        { status: 400 },
      );
    }

    const payload = parsed.data;

    const existing = await prisma.customer.findFirst({
      where: {
        tenantId,
        mobile: payload.mobile,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: "A customer with this mobile number already exists.",
        },
        { status: 409 },
      );
    }

    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          tenantId,
          mobile: payload.mobile,
          name: payload.name,
          email: payload.email || null,
          gender: payload.gender,
          dateOfBirth: parseDate(payload.dateOfBirth) ?? undefined,
          notes: payload.notes || null,
        },
      });

      await tx.loyaltyCard.create({
        data: {
          tenantId,
          customerId: created.id,
        },
      });

      return created;
    });

    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    console.error("Failed to create customer", error);
    return NextResponse.json({ error: "Unable to create customer." }, { status: 500 });
  }
}
