"use client";

import { Modal } from "@/components/ui/Modal";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <p className="text-sm text-[var(--muted)]">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-slate-700"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={[
            "h-10 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-70",
            danger ? "bg-red-600" : "bg-[var(--primary)]",
          ].join(" ")}
        >
          {loading ? "Please wait..." : confirmText}
        </button>
      </div>
    </Modal>
  );
}
