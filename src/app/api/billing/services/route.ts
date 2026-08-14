import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const services = await prisma.service.findMany({
      where: {
        tenantId: session.user.tenantId,
        status: "ACTIVE",
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        category: true,
        price: true,
        duration: true,
      },
    });

    const groupedMap = new Map<string, Array<{ id: string; name: string; price: number; duration: number }>>();

    for (const item of services) {
      const list = groupedMap.get(item.category) ?? [];
      list.push({
        id: item.id,
        name: item.name,
        price: Number(item.price),
        duration: item.duration,
      });
      groupedMap.set(item.category, list);
    }

    const grouped = [...groupedMap.entries()].map(([category, items]) => ({
      category,
      items,
    }));

    return NextResponse.json({
      items: services.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        price: Number(item.price),
        duration: item.duration,
      })),
      grouped,
    });
  } catch (error) {
    console.error("Failed to load billing services", error);
    return NextResponse.json({ error: "Unable to load services." }, { status: 500 });
  }
}
