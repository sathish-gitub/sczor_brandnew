"use client";

import { useEffect, useState } from "react";

type SupplierOption = {
  id: string;
  name: string;
};

type SupplierSelectProps = {
  value: string;
  onChange: (supplierId: string) => void;
};

export function SupplierSelect({ value, onChange }: SupplierSelectProps) {
  const [options, setOptions] = useState<SupplierOption[]>([]);

  useEffect(() => {
    let active = true;

    async function loadSuppliers() {
      const response = await fetch("/api/inventory/suppliers", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { items?: SupplierOption[] } | null;

      if (!active || !response.ok) {
        return;
      }

      setOptions(payload?.items ?? []);
    }

    loadSuppliers();

    return () => {
      active = false;
    };
  }, []);

  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
    >
      <option value="">No supplier</option>
      {options.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </select>
  );
}
