import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({ customers: [], appointments: [], invoices: [] });
  }

  try {
    const [customers, appointments, invoices] = await Promise.all([
      prisma.customer.findMany({
        where: {
          tenantId,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { mobile: { contains: query } },
          ],
        },
        take: 5,
        orderBy: { name: "asc" },
        select: { id: true, name: true, mobile: true },
      }),
      prisma.appointment.findMany({
        where: {
          tenantId,
          OR: [
            { customer: { name: { contains: query, mode: "insensitive" } } },
            { customer: { mobile: { contains: query } } },
            { appointmentNumber: { contains: query, mode: "insensitive" } },
          ],
        },
        take: 5,
        orderBy: { appointmentDate: "desc" },
        select: {
          id: true,
          appointmentNumber: true,
          appointmentDate: true,
          appointmentTime: true,
          status: true,
          customer: { select: { name: true } },
          service: { select: { name: true } },
        },
      }),
      prisma.invoice.findMany({
        where: {
          tenantId,
          OR: [
            { invoiceNumber: { contains: query, mode: "insensitive" } },
            { customer: { name: { contains: query, mode: "insensitive" } } },
          ],
        },
        take: 5,
        orderBy: { invoiceDate: "desc" },
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          invoiceDate: true,
          customer: { select: { name: true } },
        },
      }),
    ]);

    return NextResponse.json({
      customers: customers.map((customer) => ({
        id: customer.id,
        title: customer.name,
        subtitle: customer.mobile,
        href: `/customers/${customer.id}`,
      })),
      appointments: appointments.map((appointment) => ({
        id: appointment.id,
        title: `${appointment.customer.name} - ${appointment.service.name}`,
        subtitle: `${appointment.appointmentDate.toISOString().slice(0, 10)} ${appointment.appointmentTime} · ${appointment.status}`,
        href: `/appointments/${appointment.id}`,
      })),
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        title: invoice.invoiceNumber,
        subtitle: `${invoice.customer.name} · ₹${Number(invoice.total)}`,
        href: `/billing/invoices/${invoice.id}`,
      })),
    });
  } catch (error) {
    console.error("Search failed", error);
    return NextResponse.json({ error: "Unable to search." }, { status: 500 });
  }
}
