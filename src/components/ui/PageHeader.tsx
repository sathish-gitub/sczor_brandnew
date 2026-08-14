import Link from "next/link";

type Crumb = {
  label: string;
  href?: string;
};

type PageHeaderProps = {
  title: string;
  breadcrumb?: Crumb[];
  actions?: React.ReactNode;
};

export function PageHeader({ title, breadcrumb = [], actions }: PageHeaderProps) {
  return (
    <header className="rounded-xl border border-[var(--border)] bg-white p-4">
      {breadcrumb.length > 0 ? (
        <nav className="mb-2 flex flex-wrap items-center gap-1 text-xs text-[var(--muted)]">
          {breadcrumb.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1">
              {crumb.href ? <Link href={crumb.href} className="hover:text-[var(--foreground)]">{crumb.label}</Link> : <span className="text-[var(--foreground)]">{crumb.label}</span>}
              {index < breadcrumb.length - 1 ? <span>/</span> : null}
            </span>
          ))}
        </nav>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">{title}</h1>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
