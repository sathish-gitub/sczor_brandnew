"use client";

type WhatsAppConfirmationButtonProps = {
  customerName: string;
  mobile: string;
  salonName: string;
  appointmentDate: string | Date;
  appointmentTime: string;
  className?: string;
};

function formatAppointmentDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
  }).format(date);
}

function formatAppointmentTime(time: string) {
  const [hoursPart, minutesPart] = time.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart ?? "0");
  const period = hours >= 12 ? "PM" : "AM";
  const twelveHour = hours % 12 === 0 ? 12 : hours % 12;

  return `${twelveHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

export function WhatsAppConfirmationButton({
  customerName,
  mobile,
  salonName,
  appointmentDate,
  appointmentTime,
  className,
}: WhatsAppConfirmationButtonProps) {
  const phone = mobile?.replace(/[^0-9]/g, "");

  if (!phone) {
    return null;
  }

  const message =
    `Hi ${customerName}, your appointment has been confirmed at ${salonName} on ` +
    `${formatAppointmentDate(appointmentDate)} at ${formatAppointmentTime(appointmentTime)}.\n\n${salonName}`;

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
