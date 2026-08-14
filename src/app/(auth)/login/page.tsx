"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const loginSchema = z.object({
  email: z.email("Enter a valid email address.").transform((value) =>
    value.trim().toLowerCase(),
  ),
  password: z.string().min(1, "Password is required."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });

    if (!result || result.error) {
      setFormError("Invalid email or password.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  });

  return (
    <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--accent)]">
          Welcome back
        </p>
        <h2 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
          Sign in to your salon workspace
        </h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Access bookings, billing, staff schedules, and client history from one dashboard.
        </p>
      </div>

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

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="password">
              Password
            </label>
            <Link
              href="mailto:support@sczor.com?subject=Password%20Reset"
              className="text-sm font-medium text-[var(--accent)] hover:text-[var(--primary)]"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="h-12 w-full rounded-2xl border border-[var(--border)] bg-white px-4 pr-12 text-sm text-[var(--foreground)] outline-none ring-0 placeholder:text-slate-400 focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
              placeholder="Enter your password"
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
          {isSubmitting ? "Signing in..." : "Login"}
        </button>
      </form>

      <p className="mt-6 text-sm text-[var(--muted)]">
        New to sczor?{" "}
        <Link href="/signup" className="font-semibold text-[var(--accent)] hover:text-[var(--primary)]">
          Create your salon account
        </Link>
      </p>
    </div>
  );
}