"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, LoaderCircle, ShieldCheck } from "lucide-react";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

    setDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });

    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;

    event.preventDefault();
    setDigits((prev) => {
      const next = [...prev];
      for (let i = 0; i < OTP_LENGTH; i += 1) {
        next[i] = pasted[i] ?? "";
      }
      return next;
    });
    const lastIndex = Math.min(pasted.length, OTP_LENGTH) - 1;
    if (lastIndex >= 0) {
      inputRefs.current[lastIndex]?.focus();
    }
  };

  const handleSubmit = async () => {
    const otp = digits.join("");
    setError(null);

    if (!email) {
      setError("Missing email address. Please start over.");
      return;
    }

    if (otp.length !== OTP_LENGTH) {
      setError("Please enter the complete 6-digit code.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, password }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;

      if (!response.ok || !payload?.success) {
        setError(payload?.error ?? "Invalid or expired OTP. Please try again.");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.replace("/login");
      }, 1500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || !email) return;

    setIsResending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      await response.json().catch(() => null);

      setDigits(Array(OTP_LENGTH).fill(""));
      setCooldown(RESEND_COOLDOWN_SECONDS);
      inputRefs.current[0]?.focus();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)]/10">
          <ShieldCheck className="h-7 w-7 text-[var(--accent)]" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          Reset your password
        </h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Enter the 6-digit code sent to{" "}
          <span className="font-medium text-[var(--foreground)]">{email || "your email"}</span> and choose
          a new password.
        </p>
      </div>

      {success ? (
        <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-medium text-emerald-700">
          Password reset! Redirecting to login...
        </div>
      ) : (
        <>
          <div className="mt-8 flex justify-center gap-2 sm:gap-3">
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  inputRefs.current[index] = element;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(event) => handleChange(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                onPaste={handlePaste}
                className="h-12 w-11 rounded-xl border border-[var(--border)] bg-white text-center text-lg font-semibold text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)] sm:h-14 sm:w-12"
              />
            ))}
          </div>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="password">
                New Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-[var(--border)] bg-white px-4 pr-12 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                  placeholder="At least 8 characters"
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
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="confirmPassword">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="h-12 w-full rounded-2xl border border-[var(--border)] bg-white px-4 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                placeholder="Re-enter new password"
              />
            </div>
          </div>

          {error ? <p className="mt-4 text-center text-sm text-red-600">{error}</p> : null}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Reset Password
          </button>

          <div className="mt-5 text-center text-sm text-[var(--muted)]">
            Didn&apos;t receive the code?{" "}
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || isResending}
              className="font-medium text-[var(--accent)] disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : isResending ? "Resending..." : "Resend Code"}
            </button>
          </div>
        </>
      )}

      <p className="mt-6 text-center text-sm text-[var(--muted)]">
        Remembered it after all?{" "}
        <Link href="/login" className="font-semibold text-[var(--accent)] hover:text-[var(--primary)]">
          Back to login
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
