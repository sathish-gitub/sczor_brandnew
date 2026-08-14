import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[#0D1B3E] py-16 text-white">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center">
              <Image
                src="/images/sczor_logo_light.png"
                alt="sczor"
                width={84}
                height={28}
              />
            </div>
            <p className="mt-4 text-sm font-medium text-blue-100">Less Admin. More Glam.</p>
            <p className="mt-2 text-sm text-white/60">Made with ❤️ in India</p>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-white">Product</h3>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li><Link href="/#features" className="transition hover:text-white">Features</Link></li>
              <li><Link href="/#modules" className="transition hover:text-white">All Modules</Link></li>
              <li><Link href="/#pricing" className="transition hover:text-white">Pricing</Link></li>
              <li><Link href="/#coming-soon" className="transition hover:text-white">What&apos;s Coming</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-white">Company</h3>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li><Link href="/contact" className="transition hover:text-white">Contact Us</Link></li>
              <li><Link href="/privacy" className="transition hover:text-white">Privacy Policy</Link></li>
              <li><Link href="/terms" className="transition hover:text-white">Terms of Service</Link></li>
              <li><a href="mailto:connect@droletechnologies.com" className="transition hover:text-white">Help &amp; Support</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-white">Get Started</h3>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li><Link href="/signup" className="transition hover:text-white">Create Free Account</Link></li>
              <li><Link href="/login" className="transition hover:text-white">Login</Link></li>
              <li><a href="mailto:connect@droletechnologies.com" className="transition hover:text-white">Help &amp; Support</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-5 text-sm text-white/60 sm:flex sm:items-center sm:justify-between">
          <p>© 2026 sczor. All rights reserved.</p>
          <p className="mt-2 sm:mt-0">GST-Ready · Secure · Made in India</p>
        </div>
      </div>
    </footer>
  );
}