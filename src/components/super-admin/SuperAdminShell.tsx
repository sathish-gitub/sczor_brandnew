"use client";

import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { SuperAdminSidebar } from "@/components/super-admin/SuperAdminSidebar";
import { ToastProvider } from "@/components/ui/Toast";

type SuperAdminShellProps = {
  admin: {
    name: string;
    email: string;
  };
  children: ReactNode;
};

export function SuperAdminShell({ admin, children }: SuperAdminShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[var(--background)] md:pl-60">
        <SuperAdminSidebar
          admin={admin}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />
        <div className="flex min-h-screen flex-col">
          <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4 py-3 md:hidden">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--foreground)]"
              aria-label="Open sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold text-[var(--foreground)]">Admin Panel</p>
          </div>
          <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
        </div>
      </div>
    </ToastProvider>
  );
}
