import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

const features = [
  "Multi-tenant salon operations built for owners and front desk teams.",
  "Appointments, billing, and loyalty workflows in one secure workspace.",
  "Fast onboarding with branded settings ready from day one.",
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)] lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative overflow-hidden bg-[var(--sidebar)] px-6 py-10 text-white sm:px-10 lg:px-14 lg:py-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.35),_transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(13,27,62,0))]" />
        <div className="relative mx-auto flex h-full w-full max-w-xl flex-col justify-between gap-12">
          <div className="space-y-6">
            <Link href="/" aria-label="Go to homepage" className="inline-block">
              <Image
                src="/images/sczor_logo_light.png"
                alt="sczor"
                width={144}
                height={48}
                className="h-10 w-auto cursor-pointer"
                priority
              />
            </Link>
            <div className="space-y-4">
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-blue-200/85">
                Less Admin. More Glam.
              </p>
              <h1 className="max-w-lg text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Run your salon on one system your whole team can trust.
              </h1>
              <p className="max-w-lg text-base leading-7 text-slate-300">
                sczor keeps bookings, staff, invoices, and loyalty in sync so your front desk spends less time chasing details.
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            {features.map((feature) => (
              <div
                key={feature}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm"
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-300" />
                <p className="text-sm leading-6 text-slate-200">{feature}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-8 sm:px-6 lg:px-10 lg:py-14">
        <div className="w-full max-w-md">{children}</div>
      </section>
    </div>
  );
}