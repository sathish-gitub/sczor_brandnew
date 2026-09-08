import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantSalonStatus } from "@/lib/tenantStatus";

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const statusFilter = url.searchParams.get("status")?.toUpperCase() ?? "ALL";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);

  const tenants = await prisma.tenant.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { users: { some: { email: { contains: search, mode: "insensitive" } } } },
          ],
        }
      : undefined,
    include: {
      users: {
        where: { role: "OWNER" },
        take: 1,
        select: { name: true, email: true, mobile: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();

  const mapped = tenants.map((tenant) => {
    const owner = tenant.users[0] ?? null;
    return {
      id: tenant.id,
      name: tenant.name,
      ownerName: owner?.name ?? "-",
      ownerEmail: owner?.email ?? tenant.email ?? "-",
      ownerMobile: owner?.mobile ?? tenant.phone ?? "-",
      plan: tenant.plan,
      status: getTenantSalonStatus(tenant, now),
      trialEndsAt: tenant.trialEndsAt,
      subscriptionStart: tenant.subscriptionStart,
      subscriptionEnd: tenant.subscriptionEnd,
      createdAt: tenant.createdAt,
      isActive: tenant.isActive,
    };
  });

  const filtered =
    statusFilter === "ALL" ? mapped : mapped.filter((tenant) => tenant.status === statusFilter);

  const total = filtered.length;
  const start = (page - 1) * PAGE_SIZE;
  const paginated = filtered.slice(start, start + PAGE_SIZE);

  return NextResponse.json({
    salons: paginated,
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    },
  });
}
