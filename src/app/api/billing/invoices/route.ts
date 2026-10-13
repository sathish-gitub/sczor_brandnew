import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { istDayBounds, istMonthBounds, todayISTDateString } from "@/lib/time";

function parseDateOnlyParam(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  return value;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const isExport = url.searchParams.get("export") === "true";
  const limit = isExport
    ? 10000
    : Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? "20")));
  const search = url.searchParams.get("search")?.trim() ?? "";
  const paymentMethod = url.searchParams.get("paymentMethod")?.trim();
  const from = parseDateOnlyParam(url.searchParams.get("from"));
  const to = parseDateOnlyParam(url.searchParams.get("to"));
  const fromInstant = from ? istDayBounds(from).start : undefined;
  const toInstant = to ? istDayBounds(to).end : undefined;

  const where = {
    tenantId: session.user.tenantId,
    paymentMethod:
      paymentMethod && paymentMethod !== "ALL"
        ? (paymentMethod as "CASH" | "UPI" | "CARD" | "WALLET")
        : undefined,
    invoiceDate:
      from || to
        ? {
            gte: fromInstant,
            lt: toInstant,
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
    const total = await prisma.invoice.count({ where });

    if (isExport && total > 50000) {
      return NextResponse.json(
        {
          error: "Too many records to export",
          message: "This export would include more than 50,000 records. Please narrow your date range or filters and try again.",
        },
        { status: 400 }
      );
    }

    const todayStr = todayISTDateString();
    const today = istDayBounds(todayStr);
    const thisMonth = istMonthBounds(todayStr);

    const [invoices, todayAggregate, monthAggregate] = await Promise.all([
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
            lt: today.end,
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
            lt: thisMonth.end,
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
