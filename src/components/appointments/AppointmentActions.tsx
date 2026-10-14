"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";

import { useAccess } from "@/contexts/AccessContext";
import type { AppointmentStatusValue } from "@/lib/appointmentStatusStyles";
import {
  canCancelAppointment,
  canConvertToInvoice,
  canViewInvoice,
} from "@/lib/appointmentStatusActions";

type AppointmentStatus = AppointmentStatusValue;

type AppointmentActionsProps = {
  appointmentId: string;
  status: AppointmentStatus;
  invoiceId?: string | null;
};

const STATUS_OPTIONS: AppointmentStatus[] = ["BOOKED", "IN_PROGRESS", "COMPLETED", "BILLED", "CANCELLED"];

export function AppointmentActions({ appointmentId, status, invoiceId = null }: AppointmentActionsProps) {
  const router = useRouter();
  const access = useAccess();
  const isReadOnly = access.accessLevel === "READ_ONLY";
  const [currentStatus, setCurrentStatus] = useState<AppointmentStatus>(status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(nextStatus: AppointmentStatus) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(payload?.error ?? "Unable to update status.");
        return;
      }

      setCurrentStatus(nextStatus);
      router.refresh();
    } catch (requestError) {
      console.error(requestError);
      setError("Unable to update status.");
    } finally {
      setLoading(false);
    }
  }

  async function cancelAppointment() {
    const allowed = window.confirm("Are you sure you want to cancel this appointment?");

    if (!allowed) {
      return;
    }

    await updateStatus("CANCELLED");
  }

  const isLocked = currentStatus === "BILLED" || currentStatus === "CANCELLED" || currentStatus === "COMPLETED";
  const canCancel = canCancelAppointment(currentStatus);
  const hasInvoice = Boolean(invoiceId);
  const showConvertToInvoice = canConvertToInvoice(currentStatus, hasInvoice) && !isReadOnly;
  const showViewInvoice = canViewInvoice(hasInvoice);
  const statusOptions = canCancel ? STATUS_OPTIONS : STATUS_OPTIONS.filter((option) => option !== "CANCELLED");

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {!isLocked ? (
          <Link
            href={`/appointments/${appointmentId}/edit`}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Edit
          </Link>
        ) : null}

        <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm">
          <span className="text-[var(--muted)]">Change Status</span>
          <select
            value={currentStatus}
            onChange={(event) => updateStatus(event.target.value as AppointmentStatus)}
            disabled={loading}
            className="bg-transparent font-semibold text-[var(--foreground)] outline-none"
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>

        {showViewInvoice ? (
          <Link
            href={`/billing/invoices/${invoiceId}`}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)]"
          >
            View Invoice
          </Link>
        ) : showConvertToInvoice ? (
          <Link
            href={`/billing?appointmentId=${appointmentId}`}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)]"
          >
            Convert to Invoice
          </Link>
        ) : null}

        {canCancel ? (
          <button
            type="button"
            onClick={cancelAppointment}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-red-300 px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Cancel"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
