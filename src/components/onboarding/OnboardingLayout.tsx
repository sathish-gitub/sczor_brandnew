import Image from "next/image";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, SkipForward } from "lucide-react";

import { StepIndicator } from "@/components/onboarding/StepIndicator";

type OnboardingLayoutProps = {
  steps: string[];
  currentStep: number;
  completedSteps: number[];
  title: string;
  description: string;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  onSkip?: () => void;
  backLabel?: string;
  nextLabel?: string;
  skipLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
  showNavigation?: boolean;
};

export function OnboardingLayout({
  steps,
  currentStep,
  completedSteps,
  title,
  description,
  children,
  onBack,
  onNext,
  onSkip,
  backLabel = "Back",
  nextLabel = "Next",
  skipLabel = "Skip for now",
  nextDisabled,
  loading,
  showNavigation = true,
}: OnboardingLayoutProps) {
  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-center">
          <Image
            src="/images/sczor_logo_dark.png"
            alt="sczor"
            width={120}
            height={40}
            priority
          />
        </div>

        <div className="rounded-[32px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8 lg:p-10">
          <StepIndicator
            steps={steps}
            currentStep={currentStep}
            completedSteps={completedSteps}
          />

          <div className="mt-10 space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
              {title}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">{description}</p>
          </div>

          <div key={currentStep} className="mt-10 animate-[rise-fade_260ms_ease-out]">
            {children}
          </div>

          {showNavigation ? (
            <div className="mt-10 flex flex-col gap-4 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="sm:w-40">
                {onBack ? (
                  <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {backLabel}
                  </button>
                ) : null}
              </div>

              <div className="flex justify-center sm:flex-1">
                {onSkip ? (
                  <button
                    type="button"
                    onClick={onSkip}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-[var(--muted)] hover:text-[var(--accent)]"
                  >
                    <SkipForward className="h-4 w-4" />
                    {skipLabel}
                  </button>
                ) : null}
              </div>

              <div className="sm:w-40 sm:text-right">
                {onNext ? (
                  <button
                    type="button"
                    onClick={onNext}
                    disabled={nextDisabled || loading}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(30,64,175,0.28)] hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? "Saving..." : nextLabel}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}