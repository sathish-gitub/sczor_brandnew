import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getISTMonth, getISTYear, istDayBounds, istMonthBounds, todayISTDateString } from "@/lib/time";

function parseDateOnlyParam(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  return value;
}

function monthKey(date: Date) {
  const year = getISTYear(date);
  const month = `${getISTMonth(date)}`.padStart(2, "0");
  return `${year}-${month}`;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const startDateStr = parseDateOnlyParam(url.searchParams.get("startDate"));
  const endDateStr = parseDateOnlyParam(url.searchParams.get("endDate"));

  const fallback = istMonthBounds(todayISTDateString());
  const from = startDateStr ? istDayBounds(startDateStr).start : fallback.start;
  const to = endDateStr ? istDayBounds(endDateStr).end : fallback.end;

  try {
    const [totalCustomers, newCustomers, appointments, invoices, customers] = await Promise.all([
      prisma.customer.count({
        where: {
          tenantId: session.user.tenantId,
        },
      }),
      prisma.customer.count({
        where: {
          tenantId: session.user.tenantId,
          createdAt: {
            gte: from,
            lt: to,
          },
        },
      }),
      prisma.appointment.findMany({
        where: {
          tenantId: session.user.tenantId,
          appointmentDate: {
            gte: from,
            lt: to,
          },
        },
        select: {
          customerId: true,
          appointmentDate: true,
        },
      }),
      prisma.invoice.findMany({
        where: {
          tenantId: session.user.tenantId,
          paymentStatus: "PAID",
          invoiceDate: {
            gte: from,
            lt: to,
          },
        },
        select: {
          customerId: true,
          total: true,
          invoiceDate: true,
        },
      }),
      prisma.customer.findMany({
        where: {
          tenantId: session.user.tenantId,
        },
        select: {
          id: true,
          name: true,
          mobile: true,
          loyaltyCard: {
            select: {
              tier: true,
            },
          },
        },
      }),
    ]);

    const visitCount = new Map<string, number>();
    const lastVisit = new Map<string, Date>();
    for (const appt of appointments) {
      visitCount.set(appt.customerId, (visitCount.get(appt.customerId) ?? 0) + 1);

      const existing = lastVisit.get(appt.customerId);
      if (!existing || appt.appointmentDate > existing) {
        lastVisit.set(appt.customerId, appt.appointmentDate);
      }
    }

    const revenueByCustomer = new Map<string, number>();
    const acquisitionMap = new Map<string, { newCount: number; returningCount: number; totalVisits: number }>();

    for (const invoice of invoices) {
      revenueByCustomer.set(invoice.customerId, (revenueByCustomer.get(invoice.customerId) ?? 0) + Number(invoice.total));
    }

    for (const appt of appointments) {
      const key = monthKey(appt.appointmentDate);
      const row = acquisitionMap.get(key) ?? { newCount: 0, returningCount: 0, totalVisits: 0 };
      row.totalVisits += 1;
      acquisitionMap.set(key, row);
    }

    let returningCustomers = 0;
    for (const count of visitCount.values()) {
      if (count > 1) {
        returningCustomers += 1;
      }
    }

    const totalVisits = appointments.length;
    const totalSpent = invoices.reduce((sum, item) => sum + Number(item.total), 0);
    const averageSpendPerVisit = totalVisits > 0 ? Math.round((totalSpent / totalVisits) * 100) / 100 : 0;

    const topCustomers = customers
      .map((customer) => ({
        customerId: customer.id,
        name: customer.name,
        mobile: customer.mobile,
        visits: visitCount.get(customer.id) ?? 0,
        totalSpent: Math.round((revenueByCustomer.get(customer.id) ?? 0) * 100) / 100,
        tier: customer.loyaltyCard?.tier ?? "BRONZE",
        lastVisit: lastVisit.get(customer.id) ?? null,
      }))
      .filter((item) => item.visits > 0 || item.totalSpent > 0)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 20);

    const acquisition = [...acquisitionMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, value]) => ({
        month,
        newCustomers: newCustomers,
        returning: value.returningCount,
        totalVisits: value.totalVisits,
      }));

    return NextResponse.json({
      overview: {
        totalCustomers,
        newThisMonth: newCustomers,
        returningCustomers,
        averageSpendPerVisit,
        newVsReturning: {
          newCount: Math.max(0, topCustomers.length - returningCustomers),
          returningCount: returningCustomers,
        },
      },
      topCustomers,
      acquisition,
    });
  } catch (error) {
    console.error("Failed to load customer report", error);
    return NextResponse.json({ error: "Unable to load customer report." }, { status: 500 });
  }
}
