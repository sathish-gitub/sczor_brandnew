/**
 * Builders for the two customer-facing WhatsApp messages used across the app:
 * booking confirmation (sent after an appointment is created) and the
 * post-billing message (sent after an invoice is created/paid). Keeping the
 * copy here means both buttons stay in sync and never drift from each other.
 */

import { formatClockTime12Hour, formatISTDateDDMMYYYY, formatISTInstantTime12Hour } from "@/lib/time";

export function buildPublicInvoiceUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://sczor.com";
  return `${base}/invoice/${token}`;
}

export type BookingConfirmationInput = {
  customerName: string;
  salonName: string;
  salonPhone?: string | null;
  appointmentDate: Date | string;
  appointmentTime: string; // "HH:MM", 24-hour
};

export function buildBookingConfirmationMessage(input: BookingConfirmationInput): string {
  const dateLabel = formatISTDateDDMMYYYY(input.appointmentDate);
  const timeLabel = formatClockTime12Hour(input.appointmentTime);

  const contactSentence = input.salonPhone
    ? ` If you need to reschedule or cancel your appointment, please contact us at ${input.salonPhone} at least 24 hours in advance. ⏰`
    : "";

  return (
    `Hi ${input.customerName},\n\n` +
    `Your appointment at ${input.salonName} on ${dateLabel} at ${timeLabel} is Confirmed 💇‍♀️💇‍♂️ We look forward to seeing you soon.\n\n` +
    `Please arrive 15 minutes early to your appointment to allow time to check in and relax.${contactSentence}\n\n` +
    `We can't wait to pamper you! 🧖‍♀️🧖‍♂️\n\n` +
    `Sincerely,\nThe team at ${input.salonName}`
  );
}

type PostBillingBase = {
  customerName: string;
  salonName: string;
  googleReviewUrl?: string | null;
  publicInvoiceUrl: string;
};

export type PostBillingInput =
  | (PostBillingBase & {
      isWalkIn: false;
      appointmentDate: Date | string;
      appointmentTime: string; // "HH:MM", 24-hour
    })
  | (PostBillingBase & {
      isWalkIn: true;
      invoiceDate: Date | string;
    });

export function buildPostBillingMessage(input: PostBillingInput): string {
  const dateLabel = input.isWalkIn ? formatISTDateDDMMYYYY(input.invoiceDate) : formatISTDateDDMMYYYY(input.appointmentDate);
  const timeLabel = input.isWalkIn ? formatISTInstantTime12Hour(input.invoiceDate) : formatClockTime12Hour(input.appointmentTime);
  const noun = input.isWalkIn ? "visit" : "appointment";

  const reviewLine = input.googleReviewUrl ? `\n\nPlease rate us on Google: ${input.googleReviewUrl}` : "";

  return (
    `Hi ${input.customerName},\n\n` +
    `Your ${noun} at ${input.salonName} on ${dateLabel} at ${timeLabel} is Completed.` +
    reviewLine +
    `\n\nHere is your invoice: ${input.publicInvoiceUrl}\n\n` +
    `Sincerely,\n${input.salonName}`
  );
}
