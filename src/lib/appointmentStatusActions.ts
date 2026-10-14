/**
 * Single source of truth for which appointment actions (cancel, send the
 * WhatsApp booking confirmation, convert to invoice / view invoice) are
 * available for a given status. Shared by the appointments list, the
 * detail page, and the Day View calendar panel so all three apply the same
 * rules, and by the API route so the server enforces the same cancel rule
 * the UI shows.
 */
import type { AppointmentStatusValue } from "@/lib/appointmentStatusStyles";

/** Only a Booked appointment can be cancelled; In Progress, Completed, Billed and Cancelled are all final or in-flight. */
export function canCancelAppointment(status: AppointmentStatusValue): boolean {
  return status === "BOOKED";
}

/** Human-readable reason an appointment can't be cancelled, or null when cancelling is allowed. */
export function cancelBlockedMessage(status: AppointmentStatusValue): string | null {
  switch (status) {
    case "IN_PROGRESS":
      return "Cannot cancel an in-progress appointment.";
    case "COMPLETED":
      return "Cannot cancel a completed appointment.";
    case "BILLED":
      return "Cannot cancel a billed appointment.";
    case "CANCELLED":
      return "This appointment is already cancelled.";
    default:
      return null;
  }
}

/** The booking confirmation message only makes sense before the visit starts. */
export function canSendBookingConfirmation(status: AppointmentStatusValue): boolean {
  return status === "BOOKED";
}

/** "Convert to Invoice" only applies to a Completed appointment that hasn't been billed yet. */
export function canConvertToInvoice(status: AppointmentStatusValue, hasInvoice: boolean): boolean {
  return status === "COMPLETED" && !hasInvoice;
}

/** "View Invoice" replaces "Convert to Invoice" once an invoice exists. */
export function canViewInvoice(hasInvoice: boolean): boolean {
  return hasInvoice;
}
