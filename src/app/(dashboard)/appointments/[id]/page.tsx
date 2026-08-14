import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AppointmentActions } from "@/components/appointments/AppointmentActions";
import { StatusBadge } from "@/components/appointments/StatusBadge";
import { authOptions } from "@/lib/auth";
import { maskId } from "@/lib/formatId";
import { prisma } from "@/lib/prisma";

const timeline = ["BOOKED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "BILLED"] as const;

function formatDateTime(date: Date, time: string) {
  const formattedDate = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);

  return `${formattedDate} at ${time}`;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    redirect("/login");
  }

  const { id } = await params;

  const appointment = await prisma.appointment.findFirst({
    where: {
      id,
      tenantId: session.user.tenantId,
    },
    include: {
      customer: true,
      service: true,
      staff: true,
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
        },
      },
    },
  });

  if (!appointment) {
    notFound();
  }

  const currentTimelineIndex = timeline.indexOf(appointment.status as (typeof timeline)[number]);
  const appointmentLabel =
    appointment.appointmentNumber ??
    `SCZO-${appointment.appointmentDate.getFullYear()}-${maskId(appointment.id)}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">{appointmentLabel}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Review booking, service, and staff assignment details.</p>
        </div>

        <Link
          href="/appointments"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Back to list
        </Link>
      </div>

      <section className="rounded-xl border border-[var(--border)] bg-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Appointment ID</p>
            <p className="text-lg font-semibold text-[var(--foreground)]">{appointmentLabel}</p>
            <p className="text-sm text-[var(--muted)]">{formatDateTime(appointment.appointmentDate, appointment.appointmentTime)}</p>
          </div>

          <StatusBadge status={appointment.status} />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Customer</p>
            <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{appointment.customer.name}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{appointment.customer.mobile}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{appointment.customer.email || "No email"}</p>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Service</p>
            <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{appointment.service.name}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{appointment.service.category}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Duration: {appointment.duration} min</p>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Staff</p>
            <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{appointment.staff.name}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{appointment.staff.designation}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{appointment.staff.mobile || "No mobile"}</p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <p className="text-sm font-semibold text-[var(--foreground)]">Status Timeline</p>
          <div className="grid gap-2 sm:grid-cols-5">
            {timeline.map((step, index) => {
              const reached = currentTimelineIndex >= index;

              return (
                <div key={step} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-2 text-xs">
                  <span
                    className={[
                      "inline-flex h-2.5 w-2.5 rounded-full",
                      reached ? "bg-[var(--primary)]" : "bg-slate-300",
                    ].join(" ")}
                  />
                  <span className={reached ? "font-semibold text-[var(--foreground)]" : "text-[var(--muted)]"}>
                    {step.replaceAll("_", " ")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <AppointmentActions appointmentId={appointment.id} status={appointment.status} />
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-5">
        <h2 className="text-base font-semibold text-[var(--foreground)]">Activity Log</h2>
        <ul className="mt-4 space-y-3 text-sm">
          <li className="rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-2 text-[var(--foreground)]">
            Appointment created on {formatDate(appointment.createdAt)}
          </li>
          <li className="rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-2 text-[var(--foreground)]">
            Last updated on {formatDate(appointment.updatedAt)}
          </li>
          {appointment.status === "CANCELLED" ? (
            <li className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
              Appointment marked as cancelled.
            </li>
          ) : null}
          {appointment.invoice ? (
            <li className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
              Converted to invoice {appointment.invoice.invoiceNumber}.
            </li>
          ) : null}
          {appointment.notes ? (
            <li className="rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-2 text-[var(--foreground)]">
              Notes: {appointment.notes}
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
