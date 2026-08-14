import Link from "next/link";
import { CalendarDays, Clock3, Eye, Phone } from "lucide-react";

import { StaffAvatar } from "@/components/staff/StaffAvatar";

type StaffCardProps = {
  member: {
    id: string;
    name: string;
    designation: string;
    mobile: string | null;
    status: "ACTIVE" | "INACTIVE";
    availabilityStatus?: "AVAILABLE" | "BUSY" | "OFF_DUTY";
    displayStatus?: "AVAILABLE" | "BUSY" | "OFF_DUTY" | "INACTIVE";
    todayAppointments: number;
    totalAppointments: number;
  };
};

const availabilityColors: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-700",
  BUSY: "bg-yellow-100 text-yellow-700",
  OFF_DUTY: "bg-red-100 text-red-700",
  INACTIVE: "bg-gray-100 text-gray-500",
};

export function StaffCard({ member }: StaffCardProps) {
  const displayStatus = member.displayStatus || member.availabilityStatus || "AVAILABLE";
  const statusLabel =
    displayStatus === "INACTIVE"
      ? "Inactive"
      : displayStatus.replaceAll("_", " ");
  const statusColor = availabilityColors[displayStatus] || "bg-gray-100 text-gray-500";

  return (
    <article className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <StaffAvatar name={member.name} />
          <div>
            <h3 className="text-base font-semibold text-[var(--foreground)]">{member.name}</h3>
            <p className="text-sm text-[var(--muted)]">{member.designation}</p>
          </div>
        </div>

        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 space-y-2 text-sm text-[var(--muted)]">
        <p className="inline-flex items-center gap-2">
          <Phone className="h-4 w-4" />
          {member.mobile || "No phone"}
        </p>
        <p className="inline-flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          {member.status}
        </p>
        <p className="inline-flex items-center gap-2">
          <Clock3 className="h-4 w-4" />
          {member.todayAppointments} today · {member.totalAppointments} total
        </p>
      </div>

      <Link
        href={`/staff/${member.id}`}
        className="mt-4 inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        <Eye className="h-3.5 w-3.5" />
        View Profile
      </Link>
    </article>
  );
}
