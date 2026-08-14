"use client";

import { X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastVariant = "success" | "error" | "warning" | "info";

type ToastItem = {
  id: string;
  title: string;
  message?: string;
  variant: ToastVariant;
};

type ToastInput = Omit<ToastItem, "id">;

type ToastContextValue = {
  toasts: ToastItem[];
  showToast: (input: ToastInput) => void;
  closeToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const variantClass: Record<ToastVariant, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  error: "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const closeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID();

      setToasts((current) => [...current, { ...input, id }]);

      window.setTimeout(() => {
        closeToast(id);
      }, 3000);
    },
    [closeToast],
  );

  const value = useMemo(
    () => ({
      toasts,
      showToast,
      closeToast,
    }),
    [toasts, showToast, closeToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-3 top-3 z-[100] flex w-full max-w-sm flex-col gap-2 sm:right-6 sm:top-6">
        {toasts.map((toast) => (
          <div key={toast.id} className={["pointer-events-auto rounded-xl border px-4 py-3 shadow-sm", variantClass[toast.variant]].join(" ")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.message ? <p className="mt-1 text-xs opacity-90">{toast.message}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => closeToast(toast.id)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-current/20"
                aria-label="Close toast"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider.");
  }

  return context;
}
