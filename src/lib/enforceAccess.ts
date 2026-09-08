import { prisma } from "./prisma";
import { getAccessStatus } from "./subscription";

export async function checkWriteAccess(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

  if (!tenant) {
    return { allowed: false as const, reason: "Tenant not found" };
  }

  const access = getAccessStatus(tenant);

  if (access.accessLevel === "READ_ONLY") {
    return { allowed: false as const, reason: access.message, status: access.status };
  }

  return { allowed: true as const };
}
