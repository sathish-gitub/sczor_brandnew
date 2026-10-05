"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, Truck } from "lucide-react";

type TabKey = "PRODUCTS" | "SUPPLIERS" | "PURCHASE_ORDERS" | "LOW_STOCK" | "REPORTS";

const tabs: Array<{ key: TabKey; label: string; href: string; icon?: typeof Package }> = [
  { key: "PRODUCTS", label: "Products", href: "/inventory", icon: Package },
  { key: "SUPPLIERS", label: "Suppliers", href: "/inventory/suppliers", icon: Truck },
  { key: "PURCHASE_ORDERS", label: "Purchase Orders", href: "/inventory/purchase-orders" },
  { key: "LOW_STOCK", label: "Low Stock", href: "/inventory/low-stock" },
  { key: "REPORTS", label: "Reports", href: "/reports/inventory" },
];

function resolveActiveTab(pathname: string): TabKey {
  if (pathname.startsWith("/inventory/suppliers")) {
    return "SUPPLIERS";
  }

  if (pathname.startsWith("/inventory/purchase-orders")) {
    return "PURCHASE_ORDERS";
  }

  if (pathname.startsWith("/inventory/low-stock")) {
    return "LOW_STOCK";
  }

  if (pathname.startsWith("/reports/inventory")) {
    return "REPORTS";
  }

  return "PRODUCTS";
}

export function InventoryTabs() {
  const pathname = usePathname();
  const activeTab = resolveActiveTab(pathname);

  return (
    <nav className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-white p-3">
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        const Icon = tab.icon;

        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold",
              isActive ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
            ].join(" ")}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
