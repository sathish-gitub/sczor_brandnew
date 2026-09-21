import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/enforceAccess";
import { prisma } from "@/lib/prisma";

const createSupplierSchema = z.object({
  name: z.string().trim().min(2, "Supplier name is required."),
  contactPerson: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().email("Invalid email address.").optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

async function tenantIdOrNull() {
  const session = await getServerSession(authOptions);
  return session?.user.tenantId ?? null;
}

export async function GET(request: Request) {
  const tenantId = await tenantIdOrNull();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim();

  try {
    const suppliers = await prisma.supplier.findMany({
      where: {
        tenantId,
        name: search ? { contains: search, mode: "insensitive" } : undefined,
      },
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    });

    return NextResponse.json({
      items: suppliers.map((supplier) => ({
        id: supplier.id,
        name: supplier.name,
        contactPerson: supplier.contactPerson,
        phone: supplier.phone,
        email: supplier.email,
        address: supplier.address,
        notes: supplier.notes,
        productCount: supplier._count.products,
      })),
    });
  } catch (error) {
    console.error("Failed to list suppliers", error);
    return NextResponse.json({ error: "Unable to load suppliers." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const tenantId = await tenantIdOrNull();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await checkWriteAccess(tenantId);
  if (!access.allowed) {
    return NextResponse.json(
      { error: "SUBSCRIPTION_REQUIRED", message: access.reason },
      { status: 403 },
    );
  }

  try {
    const parsed = createSupplierSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid supplier data." },
        { status: 400 },
      );
    }

    const payload = parsed.data;

    const supplier = await prisma.supplier.create({
      data: {
        tenantId,
        name: payload.name,
        contactPerson: payload.contactPerson || null,
        phone: payload.phone || null,
        email: payload.email || null,
        address: payload.address || null,
        notes: payload.notes || null,
      },
    });

    return NextResponse.json({ supplier }, { status: 201 });
  } catch (error) {
    console.error("Failed to create supplier", error);
    return NextResponse.json({ error: "Unable to create supplier." }, { status: 500 });
  }
}
