import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AccessProvider } from "@/contexts/AccessContext";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessStatus, getTrialStatus } from "@/lib/subscription";

type DashboardLayoutProps = {
  children: ReactNode;
};

function normalizeRole(role: string): "OWNER" | "MANAGER" | "STAFF" {
  if (role === "OWNER" || role === "MANAGER" || role === "STAFF") {
    return role;
  }

  return "STAFF";
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const session = await getServerSession(authOptions);

  if (session?.user?.isSuperAdmin) {
    redirect("/super-admin/dashboard");
  }

  if (!session?.user.id || !session.user.tenantId) {
    redirect("/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: {
      id: session.user.tenantId,
    },
    select: {
      name: true,
      trialEndsAt: true,
      isSubscribed: true,
      plan: true,
      subscriptionEnd: true,
    },
  });

  if (!tenant) {
    redirect("/login");
  }

  const trialStatus = getTrialStatus(tenant);
  const access = getAccessStatus(tenant);

  const user = {
    name: session.user.name ?? "Salon User",
    role: normalizeRole(session.user.role),
  };

  return (
    <AccessProvider accessLevel={access.accessLevel}>
      <DashboardShell tenantName={tenant.name} user={user}>
        {access.accessLevel === "READ_ONLY" && (
          <div className="sticky top-0 z-50 bg-red-600 py-3 text-center text-sm font-medium text-white">
            🔒 {access.message} — You can view your existing data but cannot create or edit records.
            <Link
              href="/settings/subscription"
              className="ml-3 rounded-full bg-white px-3 py-1 font-bold text-red-600 underline"
            >
              Subscribe Now →
            </Link>
          </div>
        )}
        {trialStatus.status === "TRIAL" && (
          <div className="bg-blue-600 py-2 text-center text-sm font-medium text-white">
            ⏰ Free trial: {trialStatus.daysLeft} days remaining
            <Link href="/settings/subscription" className="ml-3 font-bold underline">
              Upgrade Now →
            </Link>
          </div>
        )}
        {trialStatus.status === "TRIAL" && trialStatus.daysLeft !== null && trialStatus.daysLeft <= 3 && (
          <div className="bg-red-500 py-2 text-center text-sm font-medium text-white">
            ⚠️ Trial expires in {trialStatus.daysLeft} day(s)!
            <Link href="/settings/subscription" className="ml-3 font-bold underline">
              Subscribe Now →
            </Link>
          </div>
        )}
        {children}
      </DashboardShell>
    </AccessProvider>
  );
}