"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { LoaderCircle, MailCheck } from "lucide-react";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialUserId = searchParams.get("userId") ?? "";
  const email = searchParams.get("email") ?? "";
  const plan = searchParams.get("plan");
  const arrivedViaResend = searchParams.get("resend") === "true";

  const [userId, setUserId] = useState(initialUserId);
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!email) return;

    let active = true;

    fetch(`/api/auth/check-verified?email=${encodeURIComponent(email)}`)
      .then((response) => response.json())
      .then((data: { verified?: boolean }) => {
        if (active && data?.verified) {
          router.replace("/select-plan");
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [email, router]);

  useEffect(() => {
    if (userId || !email || !arrivedViaResend) return;

    let active = true;

    async function resolveAndResend() {
      try {
        const response = await fetch("/api/auth/resend-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { success?: boolean; userId?: string }
          | null;

        if (active && payload?.userId) {
          setUserId(payload.userId);
          setCooldown(RESEND_COOLDOWN_SECONDS);
        }
      } catch {
        // Ignore - user can still trigger a resend manually.
      }
    }

    resolveAndResend();

    return () => {
      active = false;
    };
  }, [userId, email, arrivedViaResend]);

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

  const handleVerify = async () => {
    const otp = digits.join("");
    setError(null);

    if (otp.length !== OTP_LENGTH) {
      setError("Please enter the complete 6-digit code.");
      return;
    }

    if (!userId && !email) {
      setError("Missing account reference. Please sign up again.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userId ? { userId, otp } : { email, otp }),
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
        router.replace(plan ? `/select-plan?plan=${encodeURIComponent(plan)}` : "/select-plan");
      }, 1500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || (!userId && !email)) return;

    setIsResending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userId ? { userId } : { email }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; userId?: string; error?: string }
        | null;

      if (!response.ok || !payload?.success) {
        setError(payload?.error ?? "Unable to resend OTP. Please try again.");
        return;
      }

      if (payload.userId) {
        setUserId(payload.userId);
      }

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
          <MailCheck className="h-7 w-7 text-[var(--accent)]" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          Verify your email
        </h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          We&apos;ve sent a 6-digit verification code to{" "}
          <span className="font-medium text-[var(--foreground)]">{email || "your email"}</span>.
        </p>
      </div>

      {success ? (
        <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-medium text-emerald-700">
          Email verified! Redirecting to plan selection...
        </div>
      ) : (
        <>
          {!userId && arrivedViaResend ? (
            <p className="mt-6 text-center text-sm text-[var(--muted)]">
              Please check your email for the code, or click resend below.
            </p>
          ) : null}

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

          {error ? <p className="mt-4 text-center text-sm text-red-600">{error}</p> : null}

          <button
            type="button"
            onClick={handleVerify}
            disabled={isSubmitting}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Verify Email
          </button>

          <div className="mt-5 text-center text-sm text-[var(--muted)]">
            Didn&apos;t receive the code?{" "}
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || isResending}
              className="font-medium text-[var(--accent)] disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : isResending ? "Resending..." : "Resend OTP"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}
