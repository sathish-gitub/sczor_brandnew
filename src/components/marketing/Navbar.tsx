"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

const navLinks = [
  { label: "Features", href: "/#features" },
  { label: "Modules", href: "/#modules" },
  { label: "Pricing", href: "/#pricing" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 12);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={[
        "sticky top-0 z-50 border-b border-transparent bg-white/95 backdrop-blur transition-all",
        scrolled ? "shadow-sm" : "",
      ].join(" ")}
    >
      <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center" onClick={() => setMobileOpen(false)}>
          <Image
            src="/images/sczor_logo_dark.png"
            alt="sczor"
            width={96}
            height={32}
            priority
          />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-[#0D1B3E] transition hover:text-[#2563EB]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="inline-flex h-11 items-center rounded-xl border border-[#1E40AF]/25 px-5 text-sm font-semibold text-[#1E40AF] transition hover:border-[#1E40AF]"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-11 items-center rounded-xl bg-[#1E40AF] px-5 text-sm font-semibold text-white transition hover:bg-[#2563EB]"
          >
            Start Free
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-[#0D1B3E] md:hidden"
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        className={[
          "absolute left-0 right-0 top-full border-b border-slate-200 bg-white transition-all md:hidden",
          mobileOpen ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0",
        ].join(" ")}
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="text-left text-sm font-semibold text-[#0D1B3E]"
            >
              {link.label}
            </Link>
          ))}
          <div className="flex gap-3 pt-2">
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-[#1E40AF]/25 text-sm font-semibold text-[#1E40AF]"
            >
              Login
            </Link>
            <Link
              href="/signup"
              onClick={() => setMobileOpen(false)}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-[#1E40AF] text-sm font-semibold text-white"
            >
              Start Free
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}