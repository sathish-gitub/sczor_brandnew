"use client";

import { useEffect, useState } from "react";

import { AddSupplierModal, type CreatedSupplier } from "@/components/inventory/AddSupplierModal";

type SupplierOption = {
  id: string;
  name: string;
};

type SupplierSelectProps = {
  value: string;
  onChange: (supplierId: string) => void;
};

const ADD_NEW = "__add_new_supplier__";

export function SupplierSelect({ value, onChange }: SupplierSelectProps) {
  const [options, setOptions] = useState<SupplierOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSuppliers() {
      const response = await fetch("/api/inventory/suppliers", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { items?: SupplierOption[] } | null;

      if (!active || !response.ok) {
        return;
      }

      setOptions(payload?.items ?? []);
      setLoaded(true);
    }

    loadSuppliers();

    return () => {
      active = false;
    };
  }, []);

  function handleCreated(supplier: CreatedSupplier) {
    setOptions((current) =>
      current.some((item) => item.id === supplier.id)
        ? current
        : [...current, supplier].sort((a, b) => a.name.localeCompare(b.name)),
    );
    onChange(supplier.id);
  }

  return (
    <div className="space-y-1.5">
      <select
        value={value}
        onChange={(event) => {
          if (event.target.value === ADD_NEW) {
            setShowAddModal(true);
            return;
          }

          onChange(event.target.value);
        }}
        className="h-10 w-full rounded-xl border border-[var(--border)] px-3"
      >
        <option value="">No supplier</option>
        {loaded && options.length === 0 ? <option disabled>No suppliers yet</option> : null}
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
        <option value={ADD_NEW}>+ Add New Supplier</option>
      </select>

      <AddSupplierModal open={showAddModal} onClose={() => setShowAddModal(false)} onCreated={handleCreated} />
    </div>
  );
}
