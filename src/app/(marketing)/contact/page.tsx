"use client";

import Link from "next/link";
import { Mail, MapPin, Clock, Headphones, ArrowRight } from "lucide-react";
import { useState } from "react";

type FormState = {
  businessName: string;
  contactPerson: string;
  mobile: string;
  city: string;
  numberOfStores: string;
  subscriptionRequired: string;
  address: string;
  description: string;
};

const initialForm: FormState = {
  businessName: "",
  contactPerson: "",
  mobile: "",
  city: "",
  numberOfStores: "1",
  subscriptionRequired: "Not Sure",
  address: "",
  description: "",
};

export default function ContactPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.businessName || !form.contactPerson || !form.mobile || !form.city || !form.description) {
      setError("Please fill all required fields.");
      return;
    }

    if (!/^\d{10}$/.test(form.mobile)) {
      setError("Please enter valid 10 digit mobile number.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Something went wrong.");
        return;
      }

      setSuccess("Thank you! We'll get back to you within 24 hours at connect@droletechnologies.com");
      setForm(initialForm);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="min-h-screen bg-[#F8FAFF] py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#1E40AF]">Contact</p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-[#0D1B3E] sm:text-5xl">Get in touch</h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            Interested in sczor for your salon or franchise? We&apos;d love to hear from you.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-[#0D1B3E]">Send us an enquiry</h2>
            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-5 md:grid-cols-2">
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  <span>Salon / Business Name*</span>
                  <input
                    value={form.businessName}
                    onChange={(event) => updateField("businessName", event.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-[#2563EB] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  <span>Contact Person*</span>
                  <input
                    value={form.contactPerson}
                    onChange={(event) => updateField("contactPerson", event.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-[#2563EB] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  <span>Mobile Number*</span>
                  <input
                    value={form.mobile}
                    onChange={(event) => updateField("mobile", event.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-[#2563EB] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                    inputMode="numeric"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  <span>City*</span>
                  <input
                    value={form.city}
                    onChange={(event) => updateField("city", event.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-[#2563EB] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  <span>Number of Stores/Branches*</span>
                  <select
                    value={form.numberOfStores}
                    onChange={(event) => updateField("numberOfStores", event.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none focus:border-[#2563EB] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                  >
                    <option value="1">1</option>
                    <option value="2-5">2-5</option>
                    <option value="6-10">6-10</option>
                    <option value="10+">10+</option>
                    <option value="Franchise/Chain">Franchise/Chain</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  <span>Subscription Required</span>
                  <select
                    value={form.subscriptionRequired}
                    onChange={(event) => updateField("subscriptionRequired", event.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none focus:border-[#2563EB] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                  >
                    <option value="Free">Free</option>
                    <option value="Basic ₹799">Basic ₹799</option>
                    <option value="Pro ₹1099">Pro ₹1099</option>
                    <option value="Not Sure">Not Sure</option>
                  </select>
                </label>
              </div>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                <span>Address</span>
                <textarea
                  value={form.address}
                  onChange={(event) => updateField("address", event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#2563EB] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                <span>How can we help you?*</span>
                <textarea
                  value={form.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  rows={6}
                  placeholder="Tell us about your salon, your current challenges, and what you're looking for in a salon management system."
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#2563EB] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                />
              </label>

              {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
              {success ? <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{success}</p> : null}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1E40AF] text-sm font-semibold text-white transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? "Sending..." : "Send Enquiry"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <p className="mt-4 text-sm text-slate-600">
              For Chain &amp; Franchise enquiries, we offer custom pricing and dedicated support.
            </p>
          </section>

          <aside className="space-y-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <Mail className="h-5 w-5 text-[#2563EB]" />
              <h3 className="mt-4 text-lg font-bold text-[#0D1B3E]">Email us</h3>
              <a href="mailto:connect@droletechnologies.com" className="mt-2 inline-flex text-sm font-medium text-[#1E40AF] hover:text-[#2563EB]">
                connect@droletechnologies.com
              </a>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <MapPin className="h-5 w-5 text-[#2563EB]" />
              <h3 className="mt-4 text-lg font-bold text-[#0D1B3E]">Our office</h3>
              <p className="mt-2 text-sm text-slate-600">Drole Technologies Private Limited</p>
              <a
                href="https://droletechnologies.com/contact"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex text-sm font-semibold text-[#1E40AF] hover:text-[#2563EB]"
              >
                View on map →
              </a>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <Clock className="h-5 w-5 text-[#2563EB]" />
              <h3 className="mt-4 text-lg font-bold text-[#0D1B3E]">Response time</h3>
              <p className="mt-2 text-sm text-slate-600">Within 24 business hours</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <Headphones className="h-5 w-5 text-[#2563EB]" />
              <h3 className="mt-4 text-lg font-bold text-[#0D1B3E]">Help &amp; Support</h3>
              <p className="mt-2 text-sm text-slate-600">connect@droletechnologies.com</p>
            </article>
            <p className="text-sm text-slate-500">
              Looking for product details first? Return to the <Link href="/" className="font-semibold text-[#1E40AF] hover:text-[#2563EB]">landing page</Link>.
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}