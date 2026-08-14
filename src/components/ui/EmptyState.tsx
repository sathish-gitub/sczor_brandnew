import type { ReactNode } from "react";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-14 text-center">
      {icon ? <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600">{icon}</div> : null}
      <h3 className="text-base font-semibold text-[var(--foreground)]">{title}</h3>
      {description ? <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
