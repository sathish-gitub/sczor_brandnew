import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { ReactNode } from "react";

import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";
import { authOptions } from "@/lib/auth";

type SuperAdminLayoutProps = {
  children: ReactNode;
};

export default async function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isSuperAdmin) {
    redirect("/login");
  }

  const admin = {
    name: session.user.name ?? "Super Admin",
    email: session.user.email ?? "",
  };

  return <SuperAdminShell admin={admin}>{children}</SuperAdminShell>;
}
