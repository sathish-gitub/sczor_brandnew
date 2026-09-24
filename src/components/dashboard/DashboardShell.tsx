"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { maskId } from "@/lib/formatId";
import type { TrialStatus } from "@/lib/subscription";

import { Navbar } from "@/components/dashboard/Navbar";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { ToastProvider } from "@/components/ui/Toast";

type DashboardShellProps = {
  tenantName: string;
  user: {
    name: string;
    role: "OWNER" | "MANAGER" | "STAFF";
  };
  initialTrialStatus: TrialStatus;
  initialAccessMessage: string | null;
  children: ReactNode;
};

export function DashboardShell({
  tenantName,
  user,
  initialTrialStatus,
  initialAccessMessage,
  children,
}: DashboardShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [dynamicLabels, setDynamicLabels] = useState<Record<number, string>>({});
  const [trialStatus, setTrialStatus] = useState(initialTrialStatus);
  const [accessMessage, setAccessMessage] = useState(initialAccessMessage);
  const pathname = usePathname();

  useEffect(() => {
    let active = true;

    async function refreshTrialStatus() {
      try {
        const response = await fetch("/api/subscription/trial-status", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          trialStatus: TrialStatus;
          access: { accessLevel: "FULL" | "READ_ONLY"; message: string };
        };
        if (active) {
          setTrialStatus(payload.trialStatus);
          setAccessMessage(payload.access.accessLevel === "READ_ONLY" ? payload.access.message : null);
        }
      } catch {
        // Keep showing the last known status if the refresh fails.
      }
    }

    refreshTrialStatus();

    return () => {
      active = false;
    };
  }, [pathname]);

  const pathSegments = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments[0] === "dashboard") {
      return segments.slice(1);
    }

    return segments;
  }, [pathname]);

  useEffect(() => {
    let active = true;

    async function resolveLabels() {
      if (pathSegments.length === 0) {
        setDynamicLabels({});
        return;
      }

      const resolved: Record<number, string> = {};
      const [first, second, third] = pathSegments;
      const looksLikeId = (value?: string) => Boolean(value && /^[a-z0-9]{20,}$/i.test(value));

      try {
        if (first === "customers" && looksLikeId(second)) {
          const response = await fetch(`/api/customers/${second}`, { cache: "no-store" });
          const payload = (await response.json().catch(() => null)) as { customer?: { name: string } } | null;
          if (response.ok && payload?.customer?.name) {
            resolved[1] = payload.customer.name;
          }
        }

        if (first === "services" && looksLikeId(second)) {
          const response = await fetch(`/api/services/${second}`, { cache: "no-store" });
          const payload = (await response.json().catch(() => null)) as { service?: { name: string } } | null;
          if (response.ok && payload?.service?.name) {
            resolved[1] = payload.service.name;
          }
        }

        if (first === "appointments" && looksLikeId(second)) {
          const response = await fetch(`/api/appointments/${second}`, { cache: "no-store" });
          const payload = (await response.json().catch(() => null)) as { appointment?: { appointmentNumber?: string | null } } | null;
          if (response.ok) {
            resolved[1] = payload?.appointment?.appointmentNumber || `SCZO-${new Date().getFullYear()}-${maskId(second)}`;
          }
        }

        if (first === "billing" && second === "invoices" && looksLikeId(third)) {
          const response = await fetch(`/api/billing/invoices/${third}`, { cache: "no-store" });
          const payload = (await response.json().catch(() => null)) as { invoice?: { invoiceNumber: string } } | null;
          if (response.ok && payload?.invoice?.invoiceNumber) {
            resolved[2] = payload.invoice.invoiceNumber;
          }
        }
      } catch {
        // Ignore breadcrumb lookup failures and keep fallback labels.
      }

      if (active) {
        setDynamicLabels(resolved);
      }
    }

    resolveLabels();

    return () => {
      active = false;
    };
  }, [pathSegments]);

  function fallbackLabel(segment: string) {
    const predefined: Record<string, string> = {
      appointments: "Appointments",
      customers: "Customers",
      services: "Services",
      staff: "Staff",
      billing: "Billing",
      invoices: "Invoices",
      settings: "Settings",
      attendance: "Attendance",
      reports: "Reports",
      loyalty: "Loyalty",
      edit: "Edit",
      new: "New",
    };

    if (predefined[segment]) {
      return predefined[segment];
    }

    if (/^[a-z0-9]{20,}$/i.test(segment)) {
      return maskId(segment);
    }

    return segment
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  const crumbs = pathSegments.map((segment, index, all) => {
    const href = `/${all.slice(0, index + 1).join("/")}`;
    const label = dynamicLabels[index] ?? fallbackLabel(segment);
    return { href, label };
  });

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[var(--background)] md:pl-60">
        <Sidebar
          tenantName={tenantName}
          user={user}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />
        <div className="flex min-h-screen flex-col">
          <Navbar userName={user.name} onMenuClick={() => setMobileSidebarOpen(true)} />
          {accessMessage && (
            <div className="sticky top-0 z-50 mb-4 bg-red-600 py-3 text-center text-sm font-medium text-white">
              🔒 {accessMessage} — You can view your existing data but cannot create or edit records.
              <Link
                href="/settings/subscription"
                className="ml-3 rounded-full bg-white px-3 py-1 font-bold text-red-600 underline"
              >
                Subscribe Now →
              </Link>
            </div>
          )}
          {trialStatus.status === "TRIAL" && (
            <div className="mb-4 bg-blue-600 py-2 text-center text-sm font-medium text-white">
              ⏰ Free trial: {trialStatus.daysLeft} days remaining
              <Link href="/settings/subscription" className="ml-3 font-bold underline">
                Upgrade Now →
              </Link>
            </div>
          )}
          {trialStatus.status === "TRIAL" && trialStatus.daysLeft !== null && trialStatus.daysLeft <= 3 && (
            <div className="mb-4 bg-red-500 py-2 text-center text-sm font-medium text-white">
              ⚠️ Trial expires in {trialStatus.daysLeft} day(s)!
              <Link href="/settings/subscription" className="ml-3 font-bold underline">
                Subscribe Now →
              </Link>
            </div>
          )}
          <div className="flex-1 p-4 sm:p-6 lg:p-8">
            <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-[var(--muted)]">
              <Link href="/dashboard" className="hover:text-[var(--foreground)]">Dashboard</Link>
              {crumbs.map((crumb, index) => (
                <span key={crumb.href} className="inline-flex items-center gap-1">
                  <span>/</span>
                  {index === crumbs.length - 1 ? (
                    <span className="text-[var(--foreground)]">{crumb.label}</span>
                  ) : (
                    <Link href={crumb.href} className="hover:text-[var(--foreground)]">{crumb.label}</Link>
                  )}
                </span>
              ))}
            </nav>
            {children}
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}