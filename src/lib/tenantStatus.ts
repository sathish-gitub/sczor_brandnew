import { getTrialInfo } from "@/lib/subscription";

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

  // Shares getTrialInfo with the salon portal and super admin UI so this list's
  // TRIAL/EXPIRED split never disagrees with the "days left" shown elsewhere.
  if (tenant.trialEndsAt && !getTrialInfo(tenant, now).isExpired) {
    return "TRIAL";
  }

  return "EXPIRED";
}
