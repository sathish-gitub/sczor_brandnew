/**
 * Single source of truth for appointment status labels/colours, shared by
 * `StatusBadge` and the Day View calendar blocks so both stay visually
 * consistent.
 */

export type AppointmentStatusValue = "BOOKED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "BILLED";

export const APPOINTMENT_STATUS_STYLES: Record<
  AppointmentStatusValue,
  {
    label: string;
    badgeClassName: string;
    /** Pale background, 3px status-coloured left border, dark readable text (WCAG AA). */
    blockClassName: string;
    dotClassName: string;
    /** Cancelled blocks render their text struck through, in every colour mode. */
    strikeThrough?: boolean;
  }
> = {
  BOOKED: {
    label: "Booked",
    badgeClassName: "bg-[#DBEAFE] text-[#1E40AF]",
    blockClassName: "border border-slate-200 border-l-[3px] border-l-[#3B82F6] bg-[#EFF6FF] text-[#1E3A8A]",
    dotClassName: "bg-[#3B82F6]",
  },
  IN_PROGRESS: {
    label: "In Progress",
    badgeClassName: "bg-[#FEF3C7] text-[#D97706]",
    blockClassName: "border border-slate-200 border-l-[3px] border-l-[#F59E0B] bg-[#FFFBEB] text-[#78350F]",
    dotClassName: "bg-[#F59E0B]",
  },
  COMPLETED: {
    label: "Completed",
    badgeClassName: "bg-[#DCFCE7] text-[#16A34A]",
    blockClassName: "border border-slate-200 border-l-[3px] border-l-[#10B981] bg-[#ECFDF5] text-[#065F46]",
    dotClassName: "bg-[#10B981]",
  },
  CANCELLED: {
    label: "Cancelled",
    badgeClassName: "bg-[#FEE2E2] text-[#DC2626]",
    blockClassName: "border border-slate-200 border-l-[3px] border-l-[#94A3B8] bg-[#F8FAFC] text-[#475569]",
    dotClassName: "bg-[#94A3B8]",
    strikeThrough: true,
  },
  BILLED: {
    label: "Billed",
    badgeClassName: "bg-[#F3E8FF] text-[#7C3AED]",
    blockClassName: "border border-slate-200 border-l-[3px] border-l-[#A855F7] bg-[#FAF5FF] text-[#581C87]",
    dotClassName: "bg-[#A855F7]",
  },
};
