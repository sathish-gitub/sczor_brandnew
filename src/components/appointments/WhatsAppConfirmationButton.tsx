"use client";

import { buildBookingConfirmationMessage } from "@/lib/whatsappMessages";

type WhatsAppConfirmationButtonProps = {
  customerName: string;
  mobile: string;
  salonName: string;
  salonPhone?: string | null;
  appointmentDate: string | Date;
  appointmentTime: string;
  className?: string;
};

export function WhatsAppConfirmationButton({
  customerName,
  mobile,
  salonName,
  salonPhone,
  appointmentDate,
  appointmentTime,
  className,
}: WhatsAppConfirmationButtonProps) {
  const phone = mobile?.replace(/[^0-9]/g, "");

  if (!phone) {
    return null;
  }

  const message = buildBookingConfirmationMessage({
    customerName,
    salonName,
    salonPhone,
    appointmentDate,
    appointmentTime,
  });

  const url = `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;

  return (
    <button
      type="button"
      onClick={() => window.open(url, "_blank")}
      className={
        className ??
        "inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700 hover:border-[var(--accent)] hover:text-[var(--accent)]"
      }
    >
      Send WhatsApp Confirmation
    </button>
  );
}
