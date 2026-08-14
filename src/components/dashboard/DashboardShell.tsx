"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { maskId } from "@/lib/formatId";

import { Navbar } from "@/components/dashboard/Navbar";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { ToastProvider } from "@/components/ui/Toast";

type DashboardShellProps = {
  tenantName: string;
  user: {
    name: string;
    role: "OWNER" | "MANAGER" | "STAFF";
  };
  children: ReactNode;
};

export function DashboardShell({ tenantName, user, children }: DashboardShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [dynamicLabels, setDynamicLabels] = useState<Record<number, string>>({});
  const pathname = usePathname();

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