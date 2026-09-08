export type TenantSalonStatus = "TRIAL" | "MONTHLY" | "YEARLY" | "EXPIRED" | "INACTIVE";

type TenantForStatus = {
  isActive: boolean;
  plan: string;
  isSubscribed: boolean;
  trialEndsAt: Date | null;
  subscriptionEnd: Date | null;
};

export function getTenantSalonStatus(tenant: TenantForStatus, now: Date = new Date()): TenantSalonStatus {
  if (!tenant.isActive) {
    return "INACTIVE";
  }

  if (tenant.plan === "MONTHLY" || tenant.plan === "YEARLY") {
    const stillValid = !tenant.subscriptionEnd || tenant.subscriptionEnd >= now;
    if (tenant.isSubscribed && stillValid) {
      return tenant.plan;
    }
    return "EXPIRED";
  }

  if (tenant.trialEndsAt && tenant.trialEndsAt >= now) {
    return "TRIAL";
  }

  return "EXPIRED";
}
