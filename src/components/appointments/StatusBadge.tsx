import { APPOINTMENT_STATUS_STYLES, type AppointmentStatusValue } from "@/lib/appointmentStatusStyles";

type StatusBadgeProps = {
  status: AppointmentStatusValue;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = APPOINTMENT_STATUS_STYLES[status];

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${config.badgeClassName}`}>
      {config.label}
    </span>
  );
}
