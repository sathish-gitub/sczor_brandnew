/**
 * Shared helper for resolving a staff member's displayed designation.
 *
 * `Staff.designation` is the legacy free-text column (kept so old data keeps
 * showing correctly). `Staff.designationId` / the `staffDesignation` relation
 * is the new tenant-owned designation. Every read site that displays a
 * staff member's designation should go through this helper instead of
 * reading `designation` directly, so custom designations show up everywhere.
 */
export type StaffDesignationSource = {
  designation: string;
  staffDesignation?: { name: string } | null;
};

export function getStaffDesignationName(staff: StaffDesignationSource): string {
  return staff.staffDesignation?.name ?? staff.designation;
}

/** Prisma `select`/`include` fragment needed to resolve the designation name. */
export const staffDesignationSelect = {
  designation: true,
  designationId: true,
  staffDesignation: { select: { name: true } },
} as const;
