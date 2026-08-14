export default function TermsPage() {
  return (
    <section className="min-h-screen bg-[#F8FAFF] py-20">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#1E40AF]">Legal</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-[#0D1B3E] sm:text-5xl">Terms of Service</h1>
        <p className="mt-3 text-sm text-slate-500">Last updated: June 2026</p>

        <div className="mt-10 space-y-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <section>
            <h2 className="text-xl font-bold text-[#0D1B3E]">1. Acceptance of terms</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              By accessing or using sczor, you agree to these Terms of Service. If you do not agree, you should not use the platform.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-[#0D1B3E]">2. Use of service</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              You may use sczor only for lawful business purposes related to salon operations and management. You are responsible for ensuring
              that data entered into the system is accurate and that your use complies with applicable law.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-[#0D1B3E]">3. User accounts</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              You are responsible for maintaining the confidentiality of account credentials and for all activities that occur under your account.
              You must notify us promptly of any unauthorized use or security incident.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-[#0D1B3E]">4. Free plan limitations</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              The free plan may include usage limits, feature restrictions, or support limitations. We may update those limits from time to time,
              provided such changes are communicated appropriately through the service or official channels.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-[#0D1B3E]">5. Prohibited activities</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              You may not misuse the service, interfere with its operation, attempt unauthorized access, upload malicious content, or use sczor
              to violate any law, regulation, or third-party rights.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-[#0D1B3E]">6. Termination</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              We may suspend or terminate access where necessary to protect the platform, comply with legal obligations, or address material violations
              of these terms. You may stop using the service at any time.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-[#0D1B3E]">7. Limitation of liability</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              To the maximum extent permitted by law, sczor and its operators are not liable for indirect, incidental, special, consequential,
              or punitive damages arising from your use of the service.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-[#0D1B3E]">8. Contact</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              For questions regarding these terms, contact <a href="mailto:connect@droletechnologies.com" className="font-semibold text-[#1E40AF] hover:text-[#2563EB]">connect@droletechnologies.com</a>.
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}