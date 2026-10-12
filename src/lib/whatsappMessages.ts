/**
 * Builders for the two customer-facing WhatsApp messages used across the app:
 * booking confirmation (sent after an appointment is created) and the
 * post-billing message (sent after an invoice is created/paid). Keeping the
 * copy here means both buttons stay in sync and never drift from each other.
 */

const APP_TIMEZONE = "Asia/Kolkata";

export function formatDateDDMMYYYY(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: APP_TIMEZONE,
  }).format(date);
}

export function formatTime12Hour(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: APP_TIMEZONE,
  }).format(date);
}

/**
 * Appointment times are stored as plain "HH:MM" (24-hour) wall-clock strings,
 * not timestamps, so they're already in local (Asia/Kolkata) salon time and
 * can be reformatted directly without any timezone conversion.
 */
export function formatClockTime12Hour(time: string): string {
  const [hoursPart, minutesPart] = time.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart ?? "0");
  const period = hours >= 12 ? "PM" : "AM";
  const twelveHour = hours % 12 === 0 ? 12 : hours % 12;

  return `${twelveHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

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
  const dateLabel = formatDateDDMMYYYY(input.appointmentDate);
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
  const dateLabel = input.isWalkIn ? formatDateDDMMYYYY(input.invoiceDate) : formatDateDDMMYYYY(input.appointmentDate);
  const timeLabel = input.isWalkIn ? formatTime12Hour(input.invoiceDate) : formatClockTime12Hour(input.appointmentTime);
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
