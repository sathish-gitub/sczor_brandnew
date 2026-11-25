import { addISTCalendarMonths, addISTCalendarYears, diffISTCalendarDays } from "@/lib/time";

export type TrialStatus = {
  status: "ACTIVE" | "TRIAL" | "EXPIRED";
  message: string;
  daysLeft: number | null;
  requiresSubscription: boolean;
};

export type TrialInfo = {
  /** `Tenant.trialEndsAt` — the single source of truth for a trial's end date. */
  endDate: Date | null;
  /** IST calendar days remaining until (and including) `endDate`. 0 on the end date itself, negative once expired. */
  daysLeft: number;
  isExpired: boolean;
};

/**
 * Single shared helper for reading a tenant's free-trial end date. Every surface that
 * shows or edits trial dates/day-counts (the salon portal banners, the super admin
 * Salons list, the Change Plan popup, subscription.ts's own status helpers) must derive
 * its number from this function instead of re-deriving it from `trialEndsAt` directly,
 * so they can never disagree on "days left" or the trial end date.
 */
export function getTrialInfo(tenant: { trialEndsAt: Date | null }, now: Date = new Date()): TrialInfo {
  if (!tenant.trialEndsAt) {
    return { endDate: null, daysLeft: 0, isExpired: true };
  }

  const daysLeft = diffISTCalendarDays(now, tenant.trialEndsAt);

  return {
    endDate: tenant.trialEndsAt,
    daysLeft,
    isExpired: daysLeft < 0,
  };
}

export function getTrialStatus(tenant: {
  trialEndsAt: Date | null;
  isSubscribed: boolean;
  plan: string;
}): TrialStatus {
  if (tenant.isSubscribed) {
    return {
      status: "ACTIVE",
      message: "Subscription active",
      daysLeft: null,
      requiresSubscription: false,
    };
  }

  const trial = getTrialInfo(tenant);

  if (tenant.trialEndsAt && !trial.isExpired) {
    return {
      status: "TRIAL",
      message: `${trial.daysLeft} days left in free trial`,
      daysLeft: trial.daysLeft,
      requiresSubscription: false,
    };
  }

  return {
    status: "EXPIRED",
    message: "Free trial expired",
    daysLeft: 0,
    requiresSubscription: true,
  };
}

export type DashboardBannerState =
  | { state: "trial"; daysLeft: number }
  | { state: "trial_warning"; daysLeft: number }
  | { state: "plan_warning"; daysLeft: number }
  | { state: "expired" }
  | { state: "none" };

/**
 * Single source of truth for which (if any) trial/plan-expiry notification card
 * DashboardShell should render. Explicit discriminated states instead of letting
 * the shell re-derive "is this a trial, is it a paid plan, how many days left"
 * from raw tenant fields, so a paid plan nearing `subscriptionEnd` gets its own
 * warning card the same way a trial nearing `trialEndsAt` does, and the two
 * notification cards can never both render at once.
 *
 * - Paid plan (isSubscribed + subscriptionEnd): >7 days left -> "none";
 *   0-7 days left -> "plan_warning"; past the end date -> "expired" (the
 *   read-only banner, driven separately by getAccessStatus, covers messaging).
 * - Free trial (trialEndsAt, not subscribed): >7 days left -> "trial";
 *   0-7 days left -> "trial_warning"; expired -> "expired".
 * - Neither a trial end date nor a subscription end date -> "none".
 */
export function getDashboardBannerState(
  tenant: {
    trialEndsAt: Date | null;
    subscriptionEnd: Date | null;
    isSubscribed: boolean;
    plan: string;
  },
  now: Date = new Date(),
): DashboardBannerState {
  if (tenant.isSubscribed && tenant.subscriptionEnd) {
    const daysLeft = diffISTCalendarDays(now, tenant.subscriptionEnd);

    if (daysLeft < 0) {
      return { state: "expired" };
    }

    if (daysLeft <= 7) {
      return { state: "plan_warning", daysLeft };
    }

    return { state: "none" };
  }

  if (tenant.isSubscribed) {
    // Subscribed with no end date on file - nothing to count down to.
    return { state: "none" };
  }

  if (tenant.trialEndsAt) {
    const trial = getTrialInfo(tenant, now);

    if (trial.isExpired) {
      return { state: "expired" };
    }

    if (trial.daysLeft <= 7) {
      return { state: "trial_warning", daysLeft: trial.daysLeft };
    }

    return { state: "trial", daysLeft: trial.daysLeft };
  }

  return { state: "none" };
}

export function calculateSubscriptionEnd(
  plan: "MONTHLY" | "YEARLY",
  startDate: Date = new Date(),
): Date {
  return plan === "MONTHLY"
    ? addISTCalendarMonths(startDate, 1)
    : addISTCalendarYears(startDate, 1);
}

export type AccessLevel = "FULL" | "READ_ONLY";

export type AccessStatus = {
  status: "ACTIVE" | "SUBSCRIPTION_EXPIRED" | "TRIAL" | "TRIAL_EXPIRED" | "NO_PLAN";
  accessLevel: AccessLevel;
  message: string;
  daysLeft: number | null;
  renewalDate?: Date | null;
  requiresPayment?: boolean;
};

export function getAccessStatus(tenant: {
  trialEndsAt: Date | null;
  subscriptionEnd: Date | null;
  isSubscribed: boolean;
  plan: string;
}): AccessStatus {
  if (tenant.isSubscribed && tenant.subscriptionEnd) {
    const daysLeft = diffISTCalendarDays(new Date(), tenant.subscriptionEnd);

    if (daysLeft >= 0) {
      return {
        status: "ACTIVE",
        accessLevel: "FULL",
        message: "Subscription active",
        daysLeft,
        renewalDate: tenant.subscriptionEnd,
      };
    }

    return {
      status: "SUBSCRIPTION_EXPIRED",
      accessLevel: "READ_ONLY",
      message: "Your subscription has expired",
      daysLeft: 0,
      requiresPayment: true,
    };
  }

  if (tenant.trialEndsAt) {
    const trial = getTrialInfo(tenant);

    if (!trial.isExpired) {
      return {
        status: "TRIAL",
        accessLevel: "FULL",
        message: `${trial.daysLeft} days left in trial`,
        daysLeft: trial.daysLeft,
        requiresPayment: false,
      };
    }

    return {
      status: "TRIAL_EXPIRED",
      accessLevel: "READ_ONLY",
      message: "Your free trial has ended",
      daysLeft: 0,
      requiresPayment: true,
    };
  }

  return {
    status: "NO_PLAN",
    accessLevel: "READ_ONLY",
    message: "No active plan",
    daysLeft: 0,
    requiresPayment: true,
  };
}

