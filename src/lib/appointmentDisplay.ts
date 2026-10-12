/**
 * Client-safe display helpers for appointment lines (no server-only imports,
 * so this can be imported from "use client" components as well as API routes).
 */

export type DisplayLine = {
  service: { name: string };
};

/** Joins an appointment's line service names in sortOrder, e.g. "Haircut + Shave". */
export function combinedServiceNames(lines: DisplayLine[]): string {
  return lines.map((line) => line.service.name).join(" + ");
}

export type StaffDisplayLine = DisplayLine & {
  staff: { name: string } | null;
};

/** Distinct staff names across an appointment's lines, "Unassigned" for lines with no staff. */
export function distinctStaffLabel(lines: StaffDisplayLine[]): string {
  const seen = new Set<string>();
  const labels: string[] = [];

  for (const line of lines) {
    const label = line.staff?.name ?? "Unassigned";
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }

  return labels.length > 0 ? labels.join(", ") : "Unassigned";
}
