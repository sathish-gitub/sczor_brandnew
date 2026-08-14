import { Check } from "lucide-react";

type StepIndicatorProps = {
  steps: string[];
  currentStep: number;
  completedSteps: number[];
};

export function StepIndicator({ steps, currentStep, completedSteps }: StepIndicatorProps) {
  return (
    <div className="space-y-4">
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isComplete = completedSteps.includes(stepNumber);
          const isCurrent = stepNumber === currentStep;
          const isReached = stepNumber < currentStep || isComplete;

          return (
            <div key={step} className="flex items-start gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={[
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-all duration-300",
                    isComplete
                      ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                      : isCurrent
                        ? "border-[var(--primary)] bg-blue-50 text-[var(--primary)]"
                        : isReached
                          ? "border-blue-200 bg-blue-50 text-[var(--accent)]"
                          : "border-slate-200 bg-white text-slate-400",
                  ].join(" ")}
                >
                  {isComplete ? <Check className="h-5 w-5" /> : stepNumber}
                </div>
                {index < steps.length - 1 ? (
                  <div className="hidden h-px w-full min-w-4 flex-1 bg-slate-200 lg:block" />
                ) : null}
              </div>
              <div className="min-w-0">
                <p
                  className={[
                    "text-sm font-semibold leading-5",
                    isCurrent || isComplete ? "text-[var(--foreground)]" : "text-slate-400",
                  ].join(" ")}
                >
                  Step {stepNumber}
                </p>
                <p className="text-xs leading-5 text-[var(--muted)]">{step}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}