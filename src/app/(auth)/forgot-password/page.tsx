"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address.").transform((value) => value.trim().toLowerCase()),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      });

      await response.json().catch(() => null);

      // Always show the generic success message - never reveal whether the email exists.
      setSuccess(true);
      setTimeout(() => {
        router.push(`/reset-password?email=${encodeURIComponent(values.email)}`);
      }, 1500);
    } catch {
      setFormError("Something went wrong. Please try again.");
    }
  });

  return (
    <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)]/10">
          <MailCheck className="h-7 w-7 text-[var(--accent)]" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          Forgot your password?
        </h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Enter your account email and we&apos;ll send you a reset code.
        </p>
      </div>

      {success ? (
        <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-medium text-emerald-700">
          Check your email for a reset code. Redirecting...
        </div>
      ) : (
        <form className="mt-8 space-y-5" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="h-12 w-full rounded-2xl border border-[var(--border)] bg-white px-4 text-sm text-[var(--foreground)] outline-none ring-0 placeholder:text-slate-400 focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
              placeholder="owner@salon.com"
              {...register("email")}
            />
            {errors.email ? <p className="text-sm text-red-600">{errors.email.message}</p> : null}
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
            {isSubmitting ? "Sending..." : "Send Reset Code"}
          </button>

          <p className="text-center text-xs text-[var(--muted)]">
            Already have a code?{" "}
            <Link
              href={`/reset-password?email=${encodeURIComponent(getValues("email") ?? "")}`}
              className="font-semibold text-[var(--accent)] hover:text-[var(--primary)]"
            >
              Enter it here
            </Link>
          </p>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-[var(--muted)]">
        Remembered your password?{" "}
        <Link href="/login" className="font-semibold text-[var(--accent)] hover:text-[var(--primary)]">
          Back to login
        </Link>
      </p>
    </div>
  );
}
