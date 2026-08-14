import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AppointmentForm } from "@/components/appointments/AppointmentForm";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function todayDateString() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    redirect("/login");
  }

  const { customerId } = await searchParams;

  const [services, selectedCustomer] = await Promise.all([
    prisma.service.findMany({
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
    }),
    customerId
      ? prisma.customer.findFirst({
          where: {
            id: customerId,
            tenantId: session.user.tenantId,
          },
          select: {
            id: true,
            name: true,
            mobile: true,
            email: true,
          },
        })
      : null,
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">New Appointment</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Schedule a customer visit and assign the right staff member.
          </p>
        </div>

        <Link
          href="/appointments"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Back to list
        </Link>
      </div>

      <AppointmentForm
        mode="create"
        services={services.map((service) => ({
          id: service.id,
          name: service.name,
          category: service.category,
          price: Number(service.price),
          duration: service.duration,
        }))}
        initialData={
          selectedCustomer
            ? {
                customerId: selectedCustomer.id,
                customerName: selectedCustomer.name,
                mobile: selectedCustomer.mobile,
                email: selectedCustomer.email ?? "",
                notes: "",
                appointmentDate: todayDateString(),
                appointmentTime: "09:00",
                serviceId: services[0]?.id ?? "",
                staffId: "",
                duration: services[0]?.duration ?? 30,
                status: "BOOKED",
              }
            : undefined
        }
      />
    </div>
  );
}
