"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

type ModalSize = "sm" | "md" | "lg" | "xl";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: ModalSize;
  children: React.ReactNode;
};

const sizeClass: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({ open, onClose, title, size = "md", children }: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
        aria-label="Close modal backdrop"
      />
      <div className={[
        "relative z-10 w-full rounded-2xl border border-[var(--border)] bg-white p-5 shadow-xl",
        "animate-[fadeIn_180ms_ease-out]",
        sizeClass[size],
      ].join(" ")}>
        <div className="mb-4 flex items-start justify-between gap-3">
          {title ? <h2 className="text-lg font-semibold text-[var(--foreground)]">{title}</h2> : <span />}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-slate-500"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
