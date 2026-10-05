import type { Prisma } from "@/generated/prisma/client";

/**
 * Finds a tenant's ServiceCategory by trimmed, case-insensitive name and creates it if missing.
 * Returns the canonical stored name so callers can normalize the Service.category value to it.
 */
export async function upsertServiceCategory(
  tx: Prisma.TransactionClient,
  tenantId: string,
  rawName: string,
): Promise<string> {
  const name = rawName.trim();

  const existing = await tx.serviceCategory.findFirst({
    where: { tenantId, name: { equals: name, mode: "insensitive" } },
    select: { name: true },
  });

  if (existing) {
    return existing.name;
  }

  const created = await tx.serviceCategory.create({
    data: { tenantId, name },
    select: { name: true },
  });

  return created.name;
}
