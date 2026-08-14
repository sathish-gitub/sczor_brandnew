import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  if (!session?.user.id || !session.user.tenantId) {
    redirect("/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: {
      id: session.user.tenantId,
    },
    select: {
      name: true,
    },
  });

  if (!tenant) {
    redirect("/login");
  }

  const user = {
    name: session.user.name ?? "Salon User",
    role: normalizeRole(session.user.role),
  };

  return (
    <DashboardShell tenantName={tenant.name} user={user}>
      {children}
    </DashboardShell>
  );
}