type AppointmentStatus =
  | "BOOKED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "BILLED";

type StatusBadgeProps = {
  status: AppointmentStatus;
};

const styles: Record<AppointmentStatus, { label: string; className: string }> = {
  BOOKED: {
    label: "Booked",
    className: "bg-[#DBEAFE] text-[#1E40AF]",
  },
  IN_PROGRESS: {
    label: "In Progress",
    className: "bg-[#FEF3C7] text-[#D97706]",
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-[#DCFCE7] text-[#16A34A]",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-[#FEE2E2] text-[#DC2626]",
  },
  BILLED: {
    label: "Billed",
    className: "bg-[#F3E8FF] text-[#7C3AED]",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = styles[status];

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${config.className}`}>
      {config.label}
    </span>
  );
}
