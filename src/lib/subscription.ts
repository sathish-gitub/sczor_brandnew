export type TrialStatus = {
  status: "ACTIVE" | "TRIAL" | "EXPIRED";
  message: string;
  daysLeft: number | null;
  requiresSubscription: boolean;
};

export function getTrialStatus(tenant: {
  trialEndsAt: Date | null;
  isSubscribed: boolean;
  plan: string;
}): TrialStatus {
  const now = new Date();

  if (tenant.isSubscribed) {
    return {
      status: "ACTIVE",
      message: "Subscription active",
      daysLeft: null,
      requiresSubscription: false,
    };
  }

  if (tenant.trialEndsAt && now < tenant.trialEndsAt) {
    const daysLeft = Math.ceil(
      (tenant.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      status: "TRIAL",
      message: `${daysLeft} days left in free trial`,
      daysLeft,
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

export function calculateSubscriptionEnd(
  plan: "MONTHLY" | "YEARLY",
  startDate: Date = new Date(),
): Date {
  const end = new Date(startDate);
  if (plan === "MONTHLY") {
    end.setMonth(end.getMonth() + 1);
  } else {
    end.setFullYear(end.getFullYear() + 1);
  }
  return end;
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
  const now = new Date();

  if (tenant.isSubscribed && tenant.subscriptionEnd) {
    if (now < tenant.subscriptionEnd) {
      const daysLeft = Math.ceil(
        (tenant.subscriptionEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

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
    if (now < tenant.trialEndsAt) {
      const daysLeft = Math.ceil(
        (tenant.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      return {
        status: "TRIAL",
        accessLevel: "FULL",
        message: `${daysLeft} days left in trial`,
        daysLeft,
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

