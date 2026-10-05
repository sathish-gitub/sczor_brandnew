import type { ReactNode } from "react";

import { InventoryTabs } from "@/components/inventory/InventoryTabs";

export default function InventoryLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <InventoryTabs />
      {children}
    </div>
  );
}
