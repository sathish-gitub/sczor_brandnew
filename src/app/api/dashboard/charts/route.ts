import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStaffRevenueByInvoiceLine } from "@/lib/staffRevenue";
import { istDayBounds, istMonthBounds, istWallTimeToInstant, toISTDateString, todayISTDateString } from "@/lib/time";

type ChartRange = "today" | "7d" | "30d" | "month";

/** [start, end) instants in IST for the requested chart range. */
function rangeBounds(range: string | null) {
  const todayStart = istDayBounds(todayISTDateString()).start;
  const end = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  if (range === "7d") {
    const start = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
    return { start, end };
  }

  if (range === "month") {
    const start = istMonthBounds(todayISTDateString()).start;
    return { start, end };
  }

  if (range === "today") {
    return { start: todayStart, end };
  }

  // default: 30d
  const start = new Date(todayStart.getTime() - 29 * 24 * 60 * 60 * 1000);
  return { start, end };
}

function toDateKey(date: Date) {
  return toISTDateString(date);
}

function dayKeys(start: Date, end: Date) {
  const keys: string[] = [];
  let cursor = start.getTime();

  while (cursor < end.getTime()) {
    keys.push(toDateKey(new Date(cursor)));
    cursor += 24 * 60 * 60 * 1000;
  }

  return keys;
}

function appointmentStatusLabel(status: string) {
  if (status === "COMPLETED" || status === "BILLED") return "Completed";
  if (status === "IN_PROGRESS") return "In Progress";
  if (status === "CANCELLED") return "Cancelled";
  return "Booked";
}

const APPOINTMENT_STATUS_LABELS = ["Completed", "Booked", "Cancelled", "In Progress"];

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const url = new URL(request.url);
    const range = (url.searchParams.get("range") as ChartRange | null) ?? "30d";
    const { start, end } = rangeBounds(range);
    const days = dayKeys(start, end);

    const [invoices, appointments, appointmentServiceLines, invoiceItems, customers, staffList, loyaltyCards] = await Promise.all([
      prisma.invoice.findMany({
        where: { tenantId, invoiceDate: { gte: start, lt: end } },
        select: {
          invoiceDate: true,
          total: true,
          paymentStatus: true,
          paymentMethod: true,
          staffId: true,
        },
      }),
      prisma.appointment.findMany({
        where: { tenantId, appointmentDate: { gte: start, lt: end } },
        select: {
          appointmentDate: true,
          status: true,
          customer: {
            select: { id: true, createdAt: true },
          },
        },
      }),
      // Service popularity counts AppointmentService lines (a service chosen
      // on two lines of one appointment counts twice), not appointments.
      prisma.appointmentService.findMany({
        where: { tenantId, appointment: { appointmentDate: { gte: start, lt: end } } },
        select: { serviceId: true },
      }),
      prisma.invoiceItem.findMany({
        where: {
          invoice: { tenantId, invoiceDate: { gte: start, lt: end } },
        },
        select: { serviceId: true, amount: true },
      }),
      prisma.customer.findMany({
        where: { tenantId, createdAt: { gte: start, lt: end } },
        select: { createdAt: true },
      }),
      prisma.staff.findMany({
        where: { tenantId },
        select: { id: true, name: true },
      }),
      prisma.loyaltyCard.groupBy({
        by: ["tier"],
        where: { tenantId },
        _count: { _all: true },
      }),
    ]);

    // Revenue trend: sum of PAID invoice totals per day.
    const revenueByDay = new Map<string, number>(days.map((day) => [day, 0]));
    for (const invoice of invoices) {
      if (invoice.paymentStatus !== "PAID") continue;
      const key = toDateKey(invoice.invoiceDate);
      revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + Number(invoice.total));
    }
    const revenueTrend = days.map((date) => ({ date, revenue: Math.round(revenueByDay.get(date) ?? 0) }));

    // Appointment breakdown by status.
    const breakdownCounts = new Map<string, number>(APPOINTMENT_STATUS_LABELS.map((label) => [label, 0]));
    for (const appointment of appointments) {
      const label = appointmentStatusLabel(appointment.status);
      breakdownCounts.set(label, (breakdownCounts.get(label) ?? 0) + 1);
    }
    const appointmentBreakdown = APPOINTMENT_STATUS_LABELS.map((status) => ({
      status,
      count: breakdownCounts.get(status) ?? 0,
    }));

    // Service popularity: AppointmentService LINE count per service (a
    // service chosen on 2 lines of one appointment counts twice), revenue
    // stays the actual billed amount from invoice items.
    const serviceIds = Array.from(
      new Set([
        ...appointmentServiceLines.map((line) => line.serviceId),
        ...invoiceItems.flatMap((item) => (item.serviceId ? [item.serviceId] : [])),
      ]),
    );
    const services = serviceIds.length
      ? await prisma.service.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, name: true },
        })
      : [];
    const serviceNameById = new Map(services.map((service) => [service.id, service.name]));

    const serviceCounts = new Map<string, number>();
    for (const line of appointmentServiceLines) {
      serviceCounts.set(line.serviceId, (serviceCounts.get(line.serviceId) ?? 0) + 1);
    }

    const serviceRevenue = new Map<string, number>();
    for (const item of invoiceItems) {
      if (!item.serviceId) continue;
      serviceRevenue.set(item.serviceId, (serviceRevenue.get(item.serviceId) ?? 0) + Number(item.amount));
    }

    const sortedServices = Array.from(serviceCounts.entries()).sort((a, b) => b[1] - a[1]);
    const topServices = sortedServices.slice(0, 6);
    const otherServices = sortedServices.slice(6);

    const servicePopularity = topServices.map(([serviceId, count]) => ({
      name: serviceNameById.get(serviceId) ?? "Unknown",
      count,
      revenue: Math.round(serviceRevenue.get(serviceId) ?? 0),
    }));

    if (otherServices.length > 0) {
      const otherCount = otherServices.reduce((sum, [, count]) => sum + count, 0);
      const otherRevenue = otherServices.reduce((sum, [serviceId]) => sum + (serviceRevenue.get(serviceId) ?? 0), 0);
      servicePopularity.push({ name: "Other", count: otherCount, revenue: Math.round(otherRevenue) });
    }

    // Customer growth: new signups per day vs. returning customers with an appointment that day.
    const newCustomersByDay = new Map<string, number>(days.map((day) => [day, 0]));
    for (const customer of customers) {
      const key = toDateKey(customer.createdAt);
      newCustomersByDay.set(key, (newCustomersByDay.get(key) ?? 0) + 1);
    }

    const returningByDay = new Map<string, Set<string>>(days.map((day) => [day, new Set<string>()]));
    for (const appointment of appointments) {
      const key = toDateKey(appointment.appointmentDate);
      const dayStart = istWallTimeToInstant(key, "00:00");
      if (appointment.customer.createdAt < dayStart) {
        returningByDay.get(key)?.add(appointment.customer.id);
      }
    }

    const customerGrowth = days.map((date) => ({
      date,
      newCustomers: newCustomersByDay.get(date) ?? 0,
      returningCustomers: returningByDay.get(date)?.size ?? 0,
    }));

    // Staff performance: revenue per staff member (per invoice LINE, same
    // basis as the staff report and payroll), top 6.
    const staffNameById = new Map(staffList.map((staff) => [staff.id, staff.name]));
    const staffRevenueByLine = await getStaffRevenueByInvoiceLine(
      tenantId,
      staffList.map((staff) => staff.id),
      { gte: start, lt: end },
    );
    const staffRevenue = new Map<string, number>();
    for (const [staffId, entry] of staffRevenueByLine) {
      staffRevenue.set(staffId, entry.revenue);
    }
    const staffPerformance = Array.from(staffRevenue.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([staffId, revenue]) => ({
        name: staffNameById.get(staffId) ?? "Unknown",
        revenue: Math.round(revenue),
      }));

    // Payment method split.
    const paymentMethodMap = new Map<string, { amount: number; count: number }>();
    for (const invoice of invoices) {
      if (invoice.paymentStatus !== "PAID") continue;
      const current = paymentMethodMap.get(invoice.paymentMethod) ?? { amount: 0, count: 0 };
      current.amount += Number(invoice.total);
      current.count += 1;
      paymentMethodMap.set(invoice.paymentMethod, current);
    }
    const methodLabels: Record<string, string> = { CASH: "Cash", UPI: "UPI", CARD: "Card", WALLET: "Wallet" };
    const paymentMethodSplit = Array.from(paymentMethodMap.entries()).map(([method, value]) => ({
      method: methodLabels[method] ?? method,
      amount: Math.round(value.amount),
      count: value.count,
    }));

    // Loyalty tier distribution (current snapshot, not date-scoped).
    const tierLabels: Record<string, string> = { BRONZE: "Bronze", SILVER: "Silver", GOLD: "Gold", PLATINUM: "Platinum" };
    const tierOrder = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];
    const tierCounts = new Map(loyaltyCards.map((card) => [card.tier, card._count._all]));
    const loyaltyTierDistribution = tierOrder.map((tier) => ({
      tier: tierLabels[tier],
      count: tierCounts.get(tier as never) ?? 0,
    }));

    return NextResponse.json(
      {
        revenueTrend,
        appointmentBreakdown,
        servicePopularity,
        customerGrowth,
        staffPerformance,
        paymentMethodSplit,
        loyaltyTierDistribution,
      },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (error) {
    const isDevelopment = process.env.NODE_ENV === "development";
    
    // Log full error details for debugging
    if (isDevelopment) {
      if (error instanceof Error) {
        const errorObj: Record<string, unknown> = {
          message: error.message,
          stack: error.stack,
        };
        if ("code" in error) {
          errorObj.code = (error as Record<string, unknown>).code;
        }
        console.error("Dashboard charts error:", errorObj);
      } else {
        console.error("Dashboard charts error:", error);
      }
    } else {
      console.error("Dashboard charts error:", error);
    }
    
    const message = error instanceof Error ? error.message : "Failed to load chart data.";
    const responseBody = isDevelopment 
      ? { error: "Failed", message }
      : { error: "Failed" };
    
    return NextResponse.json(responseBody, { status: 500 });
  }
}
