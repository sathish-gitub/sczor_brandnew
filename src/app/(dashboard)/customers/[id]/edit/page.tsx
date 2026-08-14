import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { CustomerForm } from "@/components/customers/CustomerForm";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function dateInputValue(value: Date | null) {
  if (!value) {
    return "";
  }

  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user.tenantId) {
    redirect("/login");
  }

  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: {
      id,
      tenantId: session.user.tenantId,
    },
  });

  if (!customer) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Edit Customer</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Update customer profile information and preferences.</p>
        </div>

        <Link
          href={`/customers/${id}`}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Back to profile
        </Link>
      </div>

      <CustomerForm
        mode="edit"
        customerId={customer.id}
        initialValues={{
          mobile: customer.mobile,
          name: customer.name,
          email: customer.email ?? "",
          gender: customer.gender ?? undefined,
          dateOfBirth: dateInputValue(customer.dateOfBirth),
          notes: customer.notes ?? "",
        }}
      />
    </div>
  );
}
