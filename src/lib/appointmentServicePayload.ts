import { z } from "zod";

import { prisma } from "@/lib/prisma";

/** Thrown for client-correctable validation failures; routes map this to a 400 response. */
export class AppointmentValidationError extends Error {}

/** Thrown when a staff conflict is detected; routes map this to a 409 response. */
export class AppointmentConflictError extends Error {}

export const serviceLineSchema = z.object({
  serviceId: z.string().cuid("Select a valid service."),
  staffId: z.string().cuid("Select a valid staff member.").nullable().optional(),
});

export const servicesArraySchema = z
  .array(serviceLineSchema)
  .min(1, "At least one service is required.");

export type RawServiceLine = {
  serviceId: string;
  staffId: string | null;
};

export type ServiceLineSnapshot = RawServiceLine & {
  price: number;
  duration: number;
  sortOrder: number;
};

/**
 * Accepts either the new `services: [{ serviceId, staffId? }]` shape or the
 * legacy single `serviceId` + `staffId` fields, and normalizes both into a
 * single line-array shape. Assumes `body.services`, if present, was already
 * shape-validated by the route's zod schema (so this never throws ZodError).
 */
export function normalizeServiceLines(body: {
  services?: Array<{ serviceId: string; staffId?: string | null }>;
  serviceId?: string;
  staffId?: string | null;
}): RawServiceLine[] {
  if (Array.isArray(body.services) && body.services.length > 0) {
    return body.services.map((line) => ({ serviceId: line.serviceId, staffId: line.staffId ?? null }));
  }

  if (body.serviceId) {
    return [{ serviceId: body.serviceId, staffId: body.staffId || null }];
  }

  throw new AppointmentValidationError("At least one service is required.");
}

/**
 * Validates every service/staff member belongs to the tenant and is active,
 * rejects duplicate services, and computes price/duration snapshots (taken
 * at booking time, independent of later Service edits).
 */
export async function resolveServiceLineSnapshots(
  tenantId: string,
  rawLines: RawServiceLine[],
): Promise<{
  lines: ServiceLineSnapshot[];
  totalDuration: number;
  totalAmount: number;
  staffNameById: Map<string, string>;
}> {
  const serviceIds = rawLines.map((line) => line.serviceId);
  const uniqueServiceIds = new Set(serviceIds);

  if (uniqueServiceIds.size !== serviceIds.length) {
    throw new AppointmentValidationError("The same service cannot be added twice in one appointment.");
  }

  const staffIds = [...new Set(rawLines.map((line) => line.staffId).filter((id): id is string => Boolean(id)))];

  const [services, staff] = await Promise.all([
    prisma.service.findMany({
      where: { tenantId, id: { in: [...uniqueServiceIds] }, status: "ACTIVE" },
      select: { id: true, price: true, duration: true },
    }),
    staffIds.length
      ? prisma.staff.findMany({
          where: { tenantId, id: { in: staffIds }, status: "ACTIVE" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const serviceMap = new Map(services.map((service) => [service.id, service]));

  if (serviceMap.size !== uniqueServiceIds.size) {
    throw new AppointmentValidationError("One or more selected services are unavailable or inactive.");
  }

  const staffMap = new Map(staff.map((member) => [member.id, member]));

  if (staffIds.some((id) => !staffMap.has(id))) {
    throw new AppointmentValidationError("One or more selected staff members are unavailable or inactive.");
  }

  const lines: ServiceLineSnapshot[] = rawLines.map((line, index) => {
    const service = serviceMap.get(line.serviceId)!;

    return {
      serviceId: line.serviceId,
      staffId: line.staffId,
      price: Number(service.price),
      duration: service.duration,
      sortOrder: index,
    };
  });

  const totalDuration = lines.reduce((sum, line) => sum + line.duration, 0);
  const totalAmount = lines.reduce((sum, line) => sum + line.price, 0);
  const staffNameById = new Map(staff.map((member) => [member.id, member.name]));

  return { lines, totalDuration, totalAmount, staffNameById };
}
