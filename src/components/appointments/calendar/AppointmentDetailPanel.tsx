"use client";

import Link from "next/link";
import { useState } from "react";
import { LoaderCircle, X } from "lucide-react";

import { StatusBadge } from "@/components/appointments/StatusBadge";
import { WhatsAppConfirmationButton } from "@/components/appointments/WhatsAppConfirmationButton";
import {
  canCancelAppointment,
  canConvertToInvoice,
  canSendBookingConfirmation,
  canViewInvoice,
} from "@/lib/appointmentStatusActions";
import type { CalendarAppointmentGroup } from "@/lib/calendarTypes";
import { formatClockTime12Hour, formatDurationLabel, formatISTDateDDMMYYYY } from "@/lib/time";
import { maskId } from "@/lib/formatId";

type AppointmentDetailPanelProps = {
  group: CalendarAppointmentGroup;
  salonName: string;
  salonPhone: string | null;
  isReadOnly: boolean;
  onClose: () => void;
  onStatusChanged: (appointmentId: string, status: CalendarAppointmentGroup["status"]) => void;
  onRefetch: () => void;
};

const STATUS_OPTIONS = ["BOOKED", "IN_PROGRESS", "COMPLETED", "BILLED", "CANCELLED"] as const;

export function AppointmentDetailPanel({
  group,
  salonName,
  salonPhone,
  isReadOnly,
  onClose,
  onStatusChanged,
  onRefetch,
}: AppointmentDetailPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mirrors AppointmentActions' lock rule: a billed, cancelled, or completed
  // appointment can no longer be edited or have its status changed further.
  const isLocked = group.status === "BILLED" || group.status === "CANCELLED" || group.status === "COMPLETED";
  const canEdit = group.status !== "BILLED" && group.status !== "CANCELLED";
  const canCancel = canCancelAppointment(group.status);
  const hasInvoice = Boolean(group.invoiceId);
  const showConvertToInvoice = canConvertToInvoice(group.status, hasInvoice) && !isReadOnly;
  const showViewInvoice = canViewInvoice(hasInvoice);
  const statusOptions = canCancel ? STATUS_OPTIONS : STATUS_OPTIONS.filter((option) => option !== "CANCELLED");

  async function updateStatus(nextStatus: (typeof STATUS_OPTIONS)[number]) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/appointments/${group.appointmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;

      if (!response.ok) {
        setError(payload?.error ?? payload?.message ?? "Unable to update status.");
        return;
      }

      onStatusChanged(group.appointmentId, nextStatus);
      onRefetch();
    } catch (requestError) {
      console.error(requestError);
      setError("Unable to update status.");
    } finally {
      setLoading(false);
    }
  }

  async function cancelAppointment() {
    const confirmed = window.confirm("Are you sure you want to cancel this appointment?");
    if (!confirmed) {
      return;
    }
    await updateStatus("CANCELLED");
  }

  const appointmentLabel = group.appointmentNumber ?? `SCZO-${maskId(group.appointmentId)}`;

  return (
    <div className="fixed inset-0 z-[95] flex justify-end" role="dialog" aria-modal="true" aria-label="Appointment details">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
        aria-label="Close appointment details"
      />

      <div className="relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-[var(--border)] bg-white p-5 shadow-xl sm:max-w-lg">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Appointment</p>
            <h2 className="text-lg font-bold text-[var(--foreground)]">{appointmentLabel}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-slate-500"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-slate-50 p-3">
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">{group.customerName}</p>
            <p className="text-xs text-[var(--muted)]">{group.customerMobile}</p>
          </div>
          <StatusBadge status={group.status} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-[var(--border)] p-3">
            <p className="text-xs text-[var(--muted)]">Date</p>
            <p className="font-semibold text-[var(--foreground)]">{formatISTDateDDMMYYYY(group.appointmentDate)}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-3">
            <p className="text-xs text-[var(--muted)]">Starts</p>
            <p className="font-semibold text-[var(--foreground)]">{formatClockTime12Hour(group.appointmentTime)}</p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold text-[var(--foreground)]">Services ({group.lines.length})</p>
          <div className="space-y-2">
            {group.lines.map((line) => (
              <div key={line.id} className="rounded-xl border border-[var(--border)] p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--foreground)]">{line.serviceName}</span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {line.lineIndex}/{line.lineCount}
                  </span>
                </div>
                <p className="mt-1 text-[var(--muted)]">
                  {formatClockTime12Hour(line.startClock)} - {formatClockTime12Hour(line.endClock)} &middot;{" "}
                  {line.staffName ?? "Unassigned"}
                </p>
                <p className="mt-1 text-[var(--muted)]">{`\u20b9${line.price.toFixed(0)} \u00b7 ${formatDurationLabel(line.duration)}`}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-[var(--border)] p-3">
            <p className="text-xs text-[var(--muted)]">Total duration</p>
            <p className="font-semibold text-[var(--foreground)]">{formatDurationLabel(group.totalDuration)}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-3">
            <p className="text-xs text-[var(--muted)]">Total price</p>
            <p className="font-semibold text-[var(--foreground)]">{`\u20b9${group.totalAmount.toFixed(0)}`}</p>
          </div>
        </div>

        {group.notes ? (
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-slate-50 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Notes</p>
            <p className="mt-1 text-[var(--foreground)]">{group.notes}</p>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-5 flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/appointments/${group.appointmentId}`}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-[var(--border)] px-3 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              View appointment
            </Link>

            {canEdit && !isReadOnly ? (
              <Link
                href={`/appointments/${group.appointmentId}/edit`}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-[var(--border)] px-3 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                Edit
              </Link>
            ) : null}
          </div>

          {showViewInvoice ? (
            <Link
              href={`/billing/invoices/${group.invoiceId}`}
              className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[var(--primary)] px-3 text-sm font-semibold text-white hover:bg-[var(--accent)]"
            >
              View Invoice
            </Link>
          ) : showConvertToInvoice ? (
            <Link
              href={`/billing?appointmentId=${group.appointmentId}`}
              className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[var(--primary)] px-3 text-sm font-semibold text-white hover:bg-[var(--accent)]"
            >
              Convert to Invoice
            </Link>
          ) : null}

          {canSendBookingConfirmation(group.status) ? (
            <WhatsAppConfirmationButton
              customerName={group.customerName}
              mobile={group.customerMobile}
              salonName={salonName}
              salonPhone={salonPhone}
              appointmentDate={group.appointmentDate}
              appointmentTime={group.appointmentTime}
              className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-[var(--border)] px-3 text-sm font-semibold text-slate-700 hover:border-[var(--accent)] hover:text-[var(--accent)]"
            />
          ) : null}

          {!isReadOnly ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {group.status === "BOOKED" ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => updateStatus("IN_PROGRESS")}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-3 text-sm font-semibold text-white hover:bg-[var(--accent)] disabled:opacity-60"
                >
                  {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Mark In Progress"}
                </button>
              ) : null}

              {group.status === "IN_PROGRESS" ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => updateStatus("COMPLETED")}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-3 text-sm font-semibold text-white hover:bg-[var(--accent)] disabled:opacity-60"
                >
                  {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Mark Completed"}
                </button>
              ) : null}

              <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm">
                <span className="text-[var(--muted)]">Status</span>
                <select
                  value={group.status}
                  disabled={loading || isLocked}
                  onChange={(event) => updateStatus(event.target.value as (typeof STATUS_OPTIONS)[number])}
                  className="bg-transparent font-semibold text-[var(--foreground)] outline-none disabled:text-slate-400"
                >
                  {statusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>

              {canCancel ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={cancelAppointment}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-red-300 px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          ) : (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              Your subscription has expired — status changes are read-only until you renew.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
