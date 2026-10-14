import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
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
      logo: true,
      address: true,
      city: true,
      state: true,
      pincode: true,
      phone: true,
      email: true,
      gstNumber: true,
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
    <AccessProvider
      accessLevel={access.accessLevel}
      tenantName={tenant.name}
      tenantLogo={tenant.logo}
      tenantAddress={tenant.address}
      tenantCity={tenant.city}
      tenantState={tenant.state}
      tenantPincode={tenant.pincode}
      tenantPhone={tenant.phone}
      tenantEmail={tenant.email}
      tenantGstNumber={tenant.gstNumber}
      userName={user.name}
    >
      <DashboardShell
        tenantName={tenant.name}
        user={user}
        initialTrialStatus={trialStatus}
        initialAccessMessage={access.accessLevel === "READ_ONLY" ? access.message : null}
      >
        {children}
      </DashboardShell>
    </AccessProvider>
  );
}