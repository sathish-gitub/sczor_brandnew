import Image from "next/image";
import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <section className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-700">
          <SearchX className="h-6 w-6" />
        </div>
        <div className="mt-4 flex justify-center">
          <Image
            src="/images/sczor_logo_dark.png"
            alt="sczor"
            width={96}
            height={32}
            priority
          />
        </div>
        <h1 className="mt-2 text-2xl font-bold text-[var(--foreground)]">Page not found</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">The page you are looking for does not exist or may have been moved.</p>
        <Link href="/dashboard" className="mt-6 inline-flex h-10 items-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white">
          Back to dashboard
        </Link>
      </section>
    </main>
  );
}
