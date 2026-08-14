type SkeletonProps = {
  className?: string;
};

function Block({ className = "" }: SkeletonProps) {
  return <div className={["animate-pulse rounded-lg bg-slate-100", className].join(" ")} />;
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2 rounded-xl border border-[var(--border)] bg-white p-4">
      <Block className="h-8 w-40" />
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <Block key={columnIndex} className="h-8" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4">
      <Block className="h-5 w-32" />
      <Block className="mt-3 h-4 w-20" />
      <Block className="mt-4 h-24 w-full" />
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-xl border border-[var(--border)] bg-white p-4">
          <Block className="h-4 w-24" />
          <Block className="mt-3 h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-5">
      <div className="flex items-center gap-4">
        <Block className="h-16 w-16 rounded-full" />
        <div className="flex-1">
          <Block className="h-5 w-40" />
          <Block className="mt-2 h-4 w-24" />
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Block className="h-10" />
        <Block className="h-10" />
        <Block className="h-10" />
        <Block className="h-10" />
      </div>
    </div>
  );
}
