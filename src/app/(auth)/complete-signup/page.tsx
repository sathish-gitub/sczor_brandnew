"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const completeSignupSchema = z.object({
  salonName: z.string().trim().min(2, "Salon name is required."),
  mobile: z.string().trim().regex(/^\d{10}$/, "Please enter a valid 10-digit mobile number."),
});

type CompleteSignupValues = z.infer<typeof completeSignupSchema>;

export default function CompleteSignupPage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CompleteSignupValues>({
    resolver: zodResolver(completeSignupSchema),
    defaultValues: { salonName: "", mobile: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    const response = await fetch("/api/auth/complete-google-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; success?: boolean; userId?: string; tenantId?: string; role?: string }
      | null;

    if (!response.ok || !payload?.success) {
      setFormError(payload?.error ?? "Unable to set up your salon.");
      return;
    }

    await update({
      userId: payload.userId,
      tenantId: payload.tenantId,
      role: payload.role,
    });

    router.push("/select-plan");
    router.refresh();
  });

  if (status === "loading") {
    return (
      <div className="flex justify-center rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-10">
        <LoaderCircle className="h-6 w-6 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--accent)]">
          Almost there
        </p>
        <h2 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
          Welcome{session?.user?.name ? `, ${session.user.name}` : ""}! Let&apos;s set up your salon.
        </h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          A couple of details and your workspace will be ready to go.
        </p>
      </div>

      <form className="mt-8 space-y-5" onSubmit={onSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="salonName">
            Salon Name
          </label>
          <input
            id="salonName"
            className="h-12 w-full rounded-2xl border border-[var(--border)] bg-white px-4 text-sm text-[var(--foreground)] outline-none placeholder:text-slate-400 focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
            placeholder="Glow House Studio"
            {...register("salonName")}
          />
          {errors.salonName ? <p className="text-sm text-red-600">{errors.salonName.message}</p> : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="mobile">
            Mobile
          </label>
          <input
            id="mobile"
            inputMode="numeric"
            autoComplete="tel"
            className="h-12 w-full rounded-2xl border border-[var(--border)] bg-white px-4 text-sm text-[var(--foreground)] outline-none placeholder:text-slate-400 focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
            placeholder="9876543210"
            {...register("mobile")}
          />
          {errors.mobile ? <p className="text-sm text-red-600">{errors.mobile.message}</p> : null}
        </div>

        {formError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-4 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(30,64,175,0.28)] hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {isSubmitting ? "Setting up..." : "Continue"}
        </button>
      </form>
    </div>
  );
}
