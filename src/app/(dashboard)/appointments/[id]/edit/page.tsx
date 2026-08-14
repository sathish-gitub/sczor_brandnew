import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AppointmentForm } from "@/components/appointments/AppointmentForm";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default async function EditAppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    redirect("/login");
  }

  const { id } = await params;

  const [appointment, services] = await Promise.all([
    prisma.appointment.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
      include: {
        customer: true,
      },
    }),
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
  ]);

  if (!appointment) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Edit Appointment</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Update customer details, schedule, or assigned staff.</p>
        </div>

        <Link
          href={`/appointments/${appointment.id}`}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Back to detail
        </Link>
      </div>

      <AppointmentForm
        mode="edit"
        services={services.map((service) => ({
          id: service.id,
          name: service.name,
          category: service.category,
          price: Number(service.price),
          duration: service.duration,
        }))}
        initialData={{
          id: appointment.id,
          customerId: appointment.customerId,
          mobile: appointment.customer.mobile,
          customerName: appointment.customer.name,
          email: appointment.customer.email ?? "",
          notes: appointment.notes ?? "",
          appointmentDate: dateInputValue(appointment.appointmentDate),
          appointmentTime: appointment.appointmentTime,
          serviceId: appointment.serviceId,
          staffId: appointment.staffId,
          duration: appointment.duration,
          status: appointment.status,
        }}
      />
    </div>
  );
}
