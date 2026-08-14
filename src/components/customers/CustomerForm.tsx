"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
  mobile: z.string().trim().regex(/^\d{10}$/, "Mobile number must be exactly 10 digits."),
  name: z.string().trim().min(2, "Customer name is required."),
  email: z.string().trim().email("Invalid email.").optional().or(z.literal("")),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  dateOfBirth: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

type CustomerFormProps = {
  mode: "create" | "edit";
  customerId?: string;
  initialValues?: Partial<FormValues>;
};

export function CustomerForm({ mode, customerId, initialValues }: CustomerFormProps) {
  const router = useRouter();
  const [mobileWarning, setMobileWarning] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      mobile: initialValues?.mobile ?? "",
      name: initialValues?.name ?? "",
      email: initialValues?.email ?? "",
      gender: initialValues?.gender,
      dateOfBirth: initialValues?.dateOfBirth ?? "",
      notes: initialValues?.notes ?? "",
    },
  });

  async function checkMobileExists() {
    const mobile = getValues("mobile");

    if (!/^\d{10}$/.test(mobile)) {
      setMobileWarning("Mobile number must be exactly 10 digits.");
      return;
    }

    setMobileWarning(null);

    const response = await fetch(`/api/customers/search?mobile=${mobile}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      items: Array<{ id: string; name: string; mobile: string }>;
    };

    const hasExisting = payload.items.some((item) => item.mobile === mobile && item.id !== customerId);

    if (hasExisting) {
      setMobileWarning("A customer with this mobile already exists.");
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);

    const endpoint = mode === "create" ? "/api/customers" : `/api/customers/${customerId}`;
    const method = mode === "create" ? "POST" : "PUT";

    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(values),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string; customer?: { id: string } } | null;

    if (!response.ok) {
      setSubmitError(payload?.error ?? "Unable to save customer.");
      return;
    }

    if (mode === "create") {
      router.push(`/customers/${payload?.customer?.id}?success=created`);
    } else {
      router.push(`/customers/${customerId}?success=updated`);
    }

    router.refresh();
  });

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-6">
      <form onSubmit={onSubmit} className="space-y-5">
        {submitError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
        ) : null}

        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]">Mobile Number *</label>
          <input
            inputMode="numeric"
            className="h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
            {...register("mobile")}
            onBlur={checkMobileExists}
          />
          {errors.mobile ? <p className="text-xs text-red-600">{errors.mobile.message}</p> : null}
          {mobileWarning ? <p className="text-xs text-amber-600">{mobileWarning}</p> : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]">Customer Name *</label>
          <input
            className="h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
            {...register("name")}
          />
          {errors.name ? <p className="text-xs text-red-600">{errors.name.message}</p> : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]">Email</label>
          <input
            type="email"
            className="h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
            {...register("email")}
          />
          {errors.email ? <p className="text-xs text-red-600">{errors.email.message}</p> : null}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--foreground)]">Gender</p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--foreground)]">
            <label className="inline-flex items-center gap-2">
              <input type="radio" value="MALE" {...register("gender")} />
              Male
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" value="FEMALE" {...register("gender")} />
              Female
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" value="OTHER" {...register("gender")} />
              Other
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]">Date of Birth</label>
          <input
            type="date"
            className="h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
            {...register("dateOfBirth")}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]">Notes / Preferences</label>
          <textarea
            rows={4}
            className="w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            {...register("notes")}
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--foreground)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {isSubmitting ? "Saving..." : "Save Customer"}
          </button>
        </div>
      </form>
    </section>
  );
}
