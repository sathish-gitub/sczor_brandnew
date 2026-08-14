import Link from "next/link";

type CustomerCardProps = {
  id: string;
  name: string;
  mobile: string;
  email?: string | null;
  createdAt: string;
  onEditHref?: string;
  onAppointmentHref?: string;
};

function initialsFromName(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function CustomerCard({
  id,
  name,
  mobile,
  email,
  createdAt,
  onEditHref,
  onAppointmentHref,
}: CustomerCardProps) {
  const joinedDate = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(createdAt));

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--sidebar)] text-2xl font-semibold text-white">
            {initialsFromName(name)}
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">{name}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">{mobile}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{email || "No email"}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
              Member since {joinedDate}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onEditHref ? (
            <Link
              href={onEditHref}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Edit
            </Link>
          ) : null}

          {onAppointmentHref ? (
            <Link
              href={onAppointmentHref}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)]"
            >
              New Appointment
            </Link>
          ) : null}

          <Link
            href={`/customers/${id}`}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            View Profile
          </Link>
        </div>
      </div>
    </section>
  );
}
