import Link from "next/link";

import { CustomerForm } from "@/components/customers/CustomerForm";

export default function NewCustomerPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Add Customer</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Create a customer profile and loyalty card in one step.</p>
        </div>

        <Link
          href="/customers"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Back to list
        </Link>
      </div>

      <CustomerForm mode="create" />
    </div>
  );
}
