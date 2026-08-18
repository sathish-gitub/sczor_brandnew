import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function dayBounds(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function monthBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function parseDateParam(value: string | null, endOfDay: boolean) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }

  return date;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? "20")));
  const search = url.searchParams.get("search")?.trim() ?? "";
  const paymentMethod = url.searchParams.get("paymentMethod")?.trim();
  const from = parseDateParam(url.searchParams.get("from"), false);
  const to = parseDateParam(url.searchParams.get("to"), true);

  const where = {
    tenantId: session.user.tenantId,
    paymentMethod:
      paymentMethod && paymentMethod !== "ALL"
        ? (paymentMethod as "CASH" | "UPI" | "CARD" | "WALLET")
        : undefined,
    invoiceDate:
      from || to
        ? {
            gte: from ?? undefined,
            lte: to ?? undefined,
          }
        : undefined,
    OR: search
      ? [
          {
            invoiceNumber: {
              contains: search,
            },
          },
          {
            customer: {
              name: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
          },
          {
            customer: {
              mobile: {
                contains: search,
              },
            },
          },
        ]
      : undefined,
  };

  try {
    const today = dayBounds();
    const thisMonth = monthBounds();

    const [total, invoices, todayAggregate, monthAggregate] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        orderBy: {
          invoiceDate: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          customer: {
            select: {
              name: true,
              mobile: true,
            },
          },
          items: {
            select: {
              quantity: true,
            },
          },
          loyaltyTxns: {
            where: {
              type: "REDEEMED",
            },
            select: {
              points: true,
            },
          },
        },
      }),
      prisma.invoice.aggregate({
        _sum: {
          total: true,
        },
        where: {
          tenantId: session.user.tenantId,
          paymentStatus: "PAID",
          invoiceDate: {
            gte: today.start,
            lte: today.end,
          },
        },
      }),
      prisma.invoice.aggregate({
        _sum: {
          total: true,
        },
        where: {
          tenantId: session.user.tenantId,
          paymentStatus: "PAID",
          invoiceDate: {
            gte: thisMonth.start,
            lte: thisMonth.end,
          },
        },
      }),
    ]);

    const totalPaidInvoices = await prisma.invoice.count({
      where: {
        tenantId: session.user.tenantId,
        paymentStatus: "PAID",
      },
    });

    const totalPaidAggregate = await prisma.invoice.aggregate({
      _sum: {
        total: true,
      },
      where: {
        tenantId: session.user.tenantId,
        paymentStatus: "PAID",
      },
    });

    const items = invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      customerName: invoice.customer.name,
      customerMobile: invoice.customer.mobile,
      itemsCount: invoice.items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: Number(invoice.subtotal),
      gst: Number(invoice.taxAmount),
      discount: Number(invoice.discount),
      loyaltyDiscount: invoice.loyaltyTxns.reduce((sum, item) => sum + item.points, 0),
      total: Number(invoice.total),
      paymentMethod: invoice.paymentMethod,
      paymentStatus: invoice.paymentStatus,
    }));

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      summary: {
        todayRevenue: Number(todayAggregate._sum.total ?? 0),
        monthRevenue: Number(monthAggregate._sum.total ?? 0),
        totalInvoices: totalPaidInvoices,
        averageInvoiceValue:
          totalPaidInvoices > 0
            ? Math.round((Number(totalPaidAggregate._sum.total ?? 0) / totalPaidInvoices) * 100) / 100
            : 0,
      },
    });
  } catch (error) {
    console.error("Failed to list invoices", error);
    return NextResponse.json({ error: "Unable to load invoices." }, { status: 500 });
  }
}
