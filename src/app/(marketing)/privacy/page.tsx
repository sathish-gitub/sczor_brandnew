export default function PrivacyPage() {
  return (
    <section className="min-h-screen bg-[#F8FAFF] py-20">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#1E40AF]">Legal</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-[#0D1B3E] sm:text-5xl">Privacy Policy</h1>
        <p className="mt-3 text-sm text-slate-500">Last updated: June 2026</p>

        <div className="mt-10 space-y-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <section>
            <h2 className="text-xl font-bold text-[#0D1B3E]">1. Information we collect</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              We collect information you provide directly to us, including account details, business information,
              customer records you choose to store in the platform, and communications submitted through forms or support channels.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-[#0D1B3E]">2. How we use your information</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              We use collected information to operate and improve sczor, provide customer support, respond to enquiries,
              maintain security, process usage analytics, and communicate important updates related to the service.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-[#0D1B3E]">3. Data security</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              We apply reasonable technical and organizational safeguards to protect personal and business information.
              No online platform can guarantee absolute security, but we continually work to protect data against unauthorized access,
              disclosure, alteration, or destruction.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-[#0D1B3E]">4. Cookies</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              sczor may use cookies and similar technologies to maintain sessions, remember preferences, and understand site performance.
              You may control cookies through your browser settings, though some functionality may be limited if cookies are disabled.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-[#0D1B3E]">5. Third-party services</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              We may rely on trusted third-party providers for infrastructure, analytics, authentication, communications, and payment-related features.
              These providers process information only as necessary to deliver their services to us.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-[#0D1B3E]">6. Contact us</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              For privacy-related questions, contact us at <a href="mailto:connect@droletechnologies.com" className="font-semibold text-[#1E40AF] hover:text-[#2563EB]">connect@droletechnologies.com</a>.
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}