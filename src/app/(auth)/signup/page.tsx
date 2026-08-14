"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const signupSchema = z
  .object({
    salonName: z.string().trim().min(2, "Salon name is required."),
    name: z.string().trim().min(2, "Owner name is required."),
    email: z.email("Enter a valid email address.").transform((value) =>
      value.trim().toLowerCase(),
    ),
    mobile: z.string().trim().regex(/^\d{10}$/, "Mobile number must be 10 digits."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(8, "Confirm your password."),
    terms: z.boolean().refine((value) => value, {
      message: "You must accept the terms to continue.",
    }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      salonName: "",
      name: "",
      email: "",
      mobile: "",
      password: "",
      confirmPassword: "",
      terms: false,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        salonName: values.salonName,
        name: values.name,
        email: values.email,
        mobile: values.mobile,
        password: values.password,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    if (!response.ok) {
      setFormError(payload?.error ?? "Unable to create your account.");
      return;
    }

    const signInResult = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });

    if (!signInResult || signInResult.error) {
      setFormError("Account created, but sign-in failed. Please log in manually.");
      router.push("/login");
      return;
    }

    router.push("/onboarding");
    router.refresh();
  });

  return (
    <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--accent)]">
          Start your workspace
        </p>
        <h2 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
          Create your salon account
        </h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Launch your branded back office with owner access, default settings, and room to scale your team.
        </p>
      </div>

      <form className="mt-8 space-y-5" onSubmit={onSubmit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
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

          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="name">
              Owner Name
            </label>
            <input
              id="name"
              className="h-12 w-full rounded-2xl border border-[var(--border)] bg-white px-4 text-sm text-[var(--foreground)] outline-none placeholder:text-slate-400 focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
              placeholder="Priya Sharma"
              {...register("name")}
            />
            {errors.name ? <p className="text-sm text-red-600">{errors.name.message}</p> : null}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="h-12 w-full rounded-2xl border border-[var(--border)] bg-white px-4 text-sm text-[var(--foreground)] outline-none placeholder:text-slate-400 focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
              placeholder="owner@glowhouse.com"
              {...register("email")}
            />
            {errors.email ? <p className="text-sm text-red-600">{errors.email.message}</p> : null}
          </div>

          <div className="space-y-2 sm:col-span-2">
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

          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className="h-12 w-full rounded-2xl border border-[var(--border)] bg-white px-4 pr-12 text-sm text-[var(--foreground)] outline-none placeholder:text-slate-400 focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                placeholder="Create a strong password"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 hover:text-[var(--foreground)]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.password ? <p className="text-sm text-red-600">{errors.password.message}</p> : null}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="confirmPassword">
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                className="h-12 w-full rounded-2xl border border-[var(--border)] bg-white px-4 pr-12 text-sm text-[var(--foreground)] outline-none placeholder:text-slate-400 focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                placeholder="Confirm your password"
                {...register("confirmPassword")}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 hover:text-[var(--foreground)]"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.confirmPassword ? <p className="text-sm text-red-600">{errors.confirmPassword.message}</p> : null}
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-slate-50/80 px-4 py-3 text-sm text-[var(--muted)]">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-[var(--border)] text-[var(--accent)]"
            {...register("terms")}
          />
          <span>I agree to the terms of service and privacy policy for my salon workspace.</span>
        </label>
        {errors.terms ? <p className="text-sm text-red-600">{errors.terms.message}</p> : null}

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
          {isSubmitting ? "Creating account..." : "Sign Up"}
        </button>
      </form>

      <p className="mt-6 text-sm text-[var(--muted)]">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[var(--accent)] hover:text-[var(--primary)]">
          Sign in
        </Link>
      </p>
    </div>
  );
}