import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { checkWriteAccess } from "@/lib/enforceAccess";
import { prisma } from "@/lib/prisma";

const updateSupplierSchema = z.object({
  name: z.string().trim().min(2, "Supplier name is required.").optional(),
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

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await tenantIdOrNull();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const supplier = await prisma.supplier.findFirst({
    where: { id, tenantId },
  });

  if (!supplier) {
    return NextResponse.json({ error: "Supplier not found." }, { status: 404 });
  }

  return NextResponse.json({ supplier });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params;

  try {
    const parsed = updateSupplierSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid supplier data." },
        { status: 400 },
      );
    }

    const payload = parsed.data;

    const updated = await prisma.supplier.updateMany({
      where: { id, tenantId },
      data: {
        name: payload.name,
        contactPerson: payload.contactPerson === "" ? null : payload.contactPerson,
        phone: payload.phone === "" ? null : payload.phone,
        email: payload.email === "" ? null : payload.email,
        address: payload.address === "" ? null : payload.address,
        notes: payload.notes === "" ? null : payload.notes,
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Supplier not found." }, { status: 404 });
    }

    const supplier = await prisma.supplier.findFirst({ where: { id, tenantId } });

    return NextResponse.json({ supplier });
  } catch (error) {
    console.error("Failed to update supplier", error);
    return NextResponse.json({ error: "Unable to update supplier." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await tenantIdOrNull();

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const usageCount = await prisma.product.count({
      where: { tenantId, supplierId: id },
    });

    if (usageCount > 0) {
      return NextResponse.json({ error: "Cannot delete supplier linked to products." }, { status: 409 });
    }

    const deleted = await prisma.supplier.deleteMany({ where: { id, tenantId } });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Supplier not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete supplier", error);
    return NextResponse.json({ error: "Unable to delete supplier." }, { status: 500 });
  }
}
