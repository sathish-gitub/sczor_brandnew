import Link from "next/link";
import { CalendarDays, Clock3, Eye, Phone, Star } from "lucide-react";

import { StaffAvatar } from "@/components/staff/StaffAvatar";
import { getAttendanceStatusStyle, getInactiveStaffLabel, type DisplayAttendanceStatus } from "@/lib/attendanceStatus";
import { formatISTTenureLabel, toISTDateString } from "@/lib/time";

type StaffCardProps = {
  member: {
    id: string;
    name: string;
    designation: string;
    mobile: string | null;
    status: "ACTIVE" | "INACTIVE";
    displayStatus?: DisplayAttendanceStatus | "INACTIVE";
    todayServicesDone: number;
    totalServicesDone: number;
    avgRating?: number;
    joiningDate?: string | null;
    experienceYears?: number | null;
    specializations?: string[];
  };
};

export function StaffCard({ member }: StaffCardProps) {
  const displayStatus = member.displayStatus ?? "NOT_MARKED";
  const isInactive = displayStatus === "INACTIVE";
  const style = isInactive
    ? { label: getInactiveStaffLabel(), badgeClassName: "bg-gray-100 text-gray-500" }
    : getAttendanceStatusStyle(displayStatus);

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

        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style.badgeClassName}`}>
          {style.label}
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
          {member.todayServicesDone} today · {member.totalServicesDone} total
        </p>
        {member.joiningDate ? (
          <p className="inline-flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            {formatISTTenureLabel(toISTDateString(new Date(member.joiningDate)))} tenure
          </p>
        ) : null}
        {member.experienceYears !== null && member.experienceYears !== undefined ? (
          <p className="inline-flex items-center gap-2">
            <Star className="h-4 w-4" />
            {member.experienceYears} yrs experience
          </p>
        ) : null}
        {member.avgRating ? (
          <p className="inline-flex items-center gap-1">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="text-xs font-semibold text-[var(--foreground)]">{member.avgRating.toFixed(1)}</span>
          </p>
        ) : null}
      </div>

      {member.specializations && member.specializations.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {member.specializations.slice(0, 4).map((item) => (
            <span key={item} className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
              {item}
            </span>
          ))}
          {member.specializations.length > 4 ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              +{member.specializations.length - 4}
            </span>
          ) : null}
        </div>
      ) : null}

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
