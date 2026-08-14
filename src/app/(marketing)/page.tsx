"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  CreditCard,
  Gift,
  Building2,
  Boxes,
  MessageCircleMore,
  MessageSquare,
  Quote,
  Settings,
  ShieldCheck,
  Smartphone,
  Star,
  TrendingUp,
  UserPlus,
  UserRoundCog,
  Users,
  WalletCards,
} from "lucide-react";

type CounterItem = {
  label: string;
  target: number;
  suffix: string;
};

const counters: CounterItem[] = [
  { label: "Salons", target: 150, suffix: "+" },
  { label: "Appointments", target: 10000, suffix: "+" },
  { label: "Customers", target: 1500, suffix: "+" },
  { label: "Less Admin Work", target: 60, suffix: "%" },
];

const modules = [
  {
    icon: CalendarCheck,
    title: "Appointment Management",
    description:
      "Smart booking with conflict detection and real-time staff availability.",
  },
  {
    icon: Users,
    title: "Customer Management",
    description:
      "Complete profiles, service history and visit tracking.",
  },
  {
    icon: WalletCards,
    title: "POS Billing System",
    description:
      "Fast billing with GST invoices and multiple payment modes.",
  },
  {
    icon: CreditCard,
    title: "Invoice Generation",
    description:
      "Professional GST invoices. Share via WhatsApp instantly.",
  },
  {
    icon: UserRoundCog,
    title: "Employee Management",
    description:
      "Staff profiles, attendance tracking and availability management.",
  },
  {
    icon: Star,
    title: "Loyalty Management",
    description:
      "Points-based rewards with Bronze, Silver, Gold, Platinum tiers.",
  },
  {
    icon: ShieldCheck,
    title: "GST Accounting",
    description:
      "GST-ready billing with CGST/SGST and tax report generation.",
  },
  {
    icon: TrendingUp,
    title: "Reports & Analytics",
    description:
      "Revenue, staff performance and customer insight reports.",
  },
  {
    icon: Smartphone,
    title: "WhatsApp Invoice Sharing",
    description:
      "Send invoices and receipts directly to customer WhatsApp after every billing.",
  },
];

const highlights = [
  {
    image:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?ixlib=rb-4.0.3&w=800&q=80",
    heading: "Smart Appointment Booking",
    points: [
      "Mobile number auto-fills customer details",
      "Real-time staff availability check",
      "Conflict detection prevents double booking",
      "Walk-in and advance booking support",
      "Filter by date, staff, and status",
    ],
  },
  {
    image:
      "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-4.0.3&w=800&q=80",
    heading: "Fast POS & GST Billing",
    points: [
      "Complete a sale in under 60 seconds",
      "Auto GST (CGST + SGST) calculation",
      "Cash, UPI, Card payment modes",
      "Send invoice on WhatsApp instantly",
      "Loyalty points earned automatically",
    ],
  },
  {
    image:
      "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?ixlib=rb-4.0.3&w=800&q=80",
    heading: "Loyalty & Customer Engagement",
    points: [
      "Earn 1 point per ₹10 spent",
      "4-tier system: Bronze to Platinum",
      "Redeem points as cash discount",
      "Complete customer history and notes",
      "Track lifetime spend per customer",
    ],
  },
];

const soonFeatures = [
  {
    icon: Gift,
    title: "Loyalty Cards & Rewards",
    description:
      "Digital loyalty cards for customers to view and track points on their phone.",
  },
  {
    icon: MessageCircleMore,
    title: "Customer Engagement",
    description:
      "Automated birthday wishes, follow-up messages and re-visit reminders.",
  },
  {
    icon: MessageSquare,
    title: "Bulk SMS Marketing",
    description:
      "Send promotional SMS campaigns to all customers or filtered segments at once.",
  },
  {
    icon: Boxes,
    title: "Inventory Management",
    description:
      "Track salon products, stock levels, purchase orders and usage per service.",
  },
  {
    icon: Building2,
    title: "Chain & Franchise Management",
    description:
      "Manage multiple branches from one account with consolidated reports.",
  },
];

const pricing = [
  {
    name: "FREE",
    price: "₹0",
    cycle: "/ month",
    featured: true,
    comingSoon: false,
    points: [
      "All 8 modules included",
      "Unlimited appointments",
      "Up to 500 customers",
      "5 staff accounts",
      "GST billing included",
      "Email support",
    ],
    cta: "Get Started Free",
  },
  {
    name: "BASIC",
    price: "₹799",
    cycle: "/ month",
    featured: false,
    comingSoon: true,
    points: [
      "Everything in Free",
      "SMS notifications",
      "WhatsApp invoice sharing",
      "Priority support",
      "Unlimited customers",
    ],
    cta: "Notify Me",
  },
  {
    name: "PRO",
    price: "₹1,099",
    cycle: "/ month",
    featured: false,
    comingSoon: true,
    points: [
      "Everything in Basic",
      "Multi-branch management",
      "Inventory management",
      "Bulk SMS campaigns",
      "Dedicated support",
    ],
    cta: "Contact Us",
  },
];

const testimonials = [
  {
    quote:
      "sczor transformed how we manage our salon. We save over 2 hours of admin work every day!",
    name: "Priya Sharma",
    role: "Owner",
    salon: "Glamour Studio, Chennai",
    initials: "PS",
  },
  {
    quote:
      "The loyalty program keeps our customers coming back. Our repeat visits improved by 40%.",
    name: "Meena Devi",
    role: "Owner",
    salon: "Beauty Palace, Bangalore",
    initials: "MD",
  },
  {
    quote:
      "GST billing used to be a nightmare. Now every invoice is generated automatically. Love it!",
    name: "Anjali Kumar",
    role: "Owner",
    salon: "Style Hub, Mumbai",
    initials: "AK",
  },
];

function formatCounter(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

export default function Home() {
  const router = useRouter();
  const [statsVisible, setStatsVisible] = useState(false);
  const [counterValues, setCounterValues] = useState<number[]>(() => counters.map(() => 0));

  useEffect(() => {
    const statsElement = document.getElementById("stats");
    if (!statsElement) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setStatsVisible(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.3 },
    );

    observer.observe(statsElement);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!statsVisible) {
      return;
    }

    const duration = 1200;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;

      setCounterValues(counters.map((item) => Math.round(item.target * eased)));

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [statsVisible]);

  useEffect(() => {
    const revealed = new Set<Element>();
    const elements = Array.from(document.querySelectorAll("[data-reveal]"));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !revealed.has(entry.target)) {
            entry.target.classList.remove("translate-y-6", "opacity-0");
            entry.target.classList.add("translate-y-0", "opacity-100");
            revealed.add(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (target: string) => {
    const element = document.getElementById(target);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="bg-[#FFFFFF] text-slate-900">
      <section id="hero" className="w-full bg-white py-16 lg:flex lg:min-h-screen lg:items-center">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-5 lg:gap-16">
            <div
              data-reveal
              className="order-1 col-span-1 translate-y-6 text-center opacity-0 transition-all duration-700 lg:col-span-2 lg:text-left"
            >
              <p className="inline-flex items-center rounded-full border border-[#1E40AF]/20 bg-white px-4 py-2 text-sm font-semibold text-[#1E40AF] shadow-sm">
                ✨ Trusted by 150+ salons across India
              </p>
              <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-[#0D1B3E] sm:text-6xl">
                Less Admin.
                <br />
                More Glam.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-700 lg:mx-0 mx-auto">
                The complete salon management platform. Appointments, billing, loyalty, staff - all in one
                place. Save 60% of your admin time every day.
              </p>

              <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
                <Link
                  href="/signup"
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#1E40AF] px-6 text-sm font-semibold text-white transition hover:bg-[#2563EB]"
                >
                  Start Free Today
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => scrollToSection("how-it-works")}
                  className="inline-flex h-12 items-center rounded-xl border border-[#1E40AF]/25 bg-white px-6 text-sm font-semibold text-[#1E40AF] transition hover:border-[#1E40AF]"
                >
                  See How It Works
                </button>
              </div>

              <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm font-medium text-slate-700 lg:justify-start">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-600" />
                  No credit card required
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-600" />
                  Setup in 5 minutes
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-600" />
                  Free forever plan
                </span>
              </div>
            </div>

            <div
              data-reveal
              className="order-2 col-span-1 translate-y-6 opacity-0 transition-all duration-700 lg:col-span-3"
            >
              <div className="relative w-full">
                <Image
                  src="/images/dashboard-preview.png"
                  alt="sczor dashboard preview"
                  width={1400}
                  height={900}
                  className="block h-auto w-full rounded-xl border border-gray-200 shadow-2xl"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="stats" className="bg-[#0D1B3E] py-10">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-8 px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
          {counters.map((counter, index) => (
            <div key={counter.label} data-reveal className="translate-y-6 text-center opacity-0 transition-all duration-700">
              <p className="text-3xl font-extrabold text-white sm:text-4xl">
                {formatCounter(counterValues[index])}
                {counter.suffix}
              </p>
              <p className="mt-2 text-sm font-medium text-blue-100">{counter.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="modules" className="py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div data-reveal className="translate-y-6 text-center opacity-0 transition-all duration-700">
            <h2 className="text-3xl font-extrabold text-[#0D1B3E] sm:text-4xl">Everything your salon needs, today</h2>
            <p className="mt-3 text-lg text-slate-600">9 powerful modules - all included free</p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {modules.map((module) => {
              const Icon = module.icon;
              return (
                <article
                  key={module.title}
                  data-reveal
                  className="translate-y-6 rounded-xl border border-slate-200 bg-white p-6 opacity-0 shadow-sm transition-all duration-700 hover:-translate-y-1 hover:shadow-md"
                >
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-[#2563EB]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-[#0D1B3E]">{module.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{module.description}</p>
                  <span className="mt-5 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <span>✅</span>
                    <span>Available Now</span>
                  </span>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-8">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Coming up next</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>
      </section>

      <section id="features" className="py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div data-reveal className="translate-y-6 text-center opacity-0 transition-all duration-700">
            <h2 className="text-3xl font-extrabold text-[#0D1B3E] sm:text-4xl">Why salons choose sczor</h2>
          </div>

          <div className="mt-12 space-y-14">
            {highlights.map((highlight, index) => (
              <div
                key={highlight.heading}
                data-reveal
                className="grid translate-y-6 items-center gap-8 opacity-0 transition-all duration-700 lg:grid-cols-2"
              >
                <div className={index % 2 === 1 ? "order-2 lg:order-2" : "order-2 lg:order-1"}>
                  <Image
                    src={highlight.image}
                    alt={highlight.heading}
                    width={800}
                    height={600}
                    className="h-[300px] w-full rounded-2xl border border-slate-200 object-cover shadow-sm"
                  />
                </div>
                <div className={index % 2 === 1 ? "order-1 lg:order-1" : "order-1 lg:order-2"}>
                  <h3 className="text-2xl font-bold text-[#0D1B3E]">{highlight.heading}</h3>
                  <ul className="mt-5 space-y-3 text-slate-700">
                    {highlight.points.map((point) => (
                      <li key={point} className="flex items-start gap-2 text-sm leading-relaxed">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="coming-soon" className="bg-[#F8FAFF] py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div data-reveal className="translate-y-6 text-center opacity-0 transition-all duration-700">
            <span className="inline-flex items-center rounded-full bg-[#FEF3C7] px-4 py-2 text-sm font-semibold text-[#92400E] shadow-sm">
              🚀 Coming Soon
            </span>
            <h2 className="mt-5 text-3xl font-extrabold text-[#0D1B3E] sm:text-4xl">More powerful features on the way</h2>
            <p className="mt-3 text-lg text-slate-600">
              We are actively building these 5 features. They will be available in upcoming releases.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {soonFeatures.map((item) => {
              const Icon = item.icon;
              const isChainFeature = item.title === "Chain & Franchise Management";

              return (
                <article
                  key={item.title}
                  data-reveal
                  className="translate-y-6 rounded-xl border-2 border-dashed border-[#CBD5E1] bg-white p-6 opacity-0 shadow-sm transition-all duration-700 hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#F1F5F9] text-slate-600">
                      <Icon className="h-5 w-5 opacity-70" />
                    </span>
                    <span className="rounded-full bg-[#FEF3C7] px-2.5 py-1 text-xs font-semibold text-[#92400E]">🚀 Coming Soon</span>
                  </div>
                  <h3 className="mt-4 text-base font-bold text-[#374151]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">{item.description}</p>
                  {isChainFeature ? (
                    <button
                      type="button"
                      onClick={() => router.push("/contact")}
                      className="mt-5 inline-flex h-10 items-center rounded-lg border border-[#1E40AF]/30 px-4 text-sm font-semibold text-[#1E40AF] transition hover:border-[#1E40AF]"
                    >
                      Enquire Now →
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>

          <div data-reveal className="mt-10 translate-y-6 rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] p-6 opacity-0 transition-all duration-700">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <p className="max-w-2xl text-sm leading-relaxed text-[#1E3A8A] sm:text-base">
                📬 Want to be notified when new features launch? Create a free account and we will notify you as each module becomes available.
              </p>
              <Link
                href="/signup"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[#1E40AF] px-5 text-sm font-semibold text-white transition hover:bg-[#2563EB]"
              >
                Create Free Account →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div data-reveal className="translate-y-6 text-center opacity-0 transition-all duration-700">
            <h2 className="text-3xl font-extrabold text-[#0D1B3E] sm:text-4xl">Up and running in 5 minutes</h2>
            <p className="mt-3 text-lg text-slate-600">No technical knowledge required</p>
          </div>

          <div className="relative mt-12">
            <div className="absolute left-0 right-0 top-7 hidden border-t-2 border-dashed border-[#BFDBFE] md:block" />
            <div className="grid gap-6 md:grid-cols-4">
              {[
                {
                  icon: UserPlus,
                  title: "Create your account",
                  description: "Sign up free. No credit card, no commitment.",
                },
                {
                  icon: Settings,
                  title: "Set up your salon",
                  description: "Add your services, staff and working hours.",
                },
                {
                  icon: CalendarCheck,
                  title: "Start booking",
                  description: "Take walk-ins or advance appointments instantly.",
                },
                {
                  icon: TrendingUp,
                  title: "Grow your business",
                  description: "Track revenue, manage loyalty, view reports.",
                },
              ].map((step, index) => {
                const Icon = step.icon;

                return (
                  <article
                    key={step.title}
                    data-reveal
                    className="relative translate-y-6 rounded-xl border border-slate-200 bg-white p-6 text-center opacity-0 shadow-sm transition-all duration-700 hover:-translate-y-1 hover:shadow-md"
                  >
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1E40AF] text-lg font-bold text-white">
                      {index + 1}
                    </div>
                    <Icon className="mx-auto mt-4 h-6 w-6 text-[#2563EB]" />
                    <h3 className="mt-4 text-lg font-bold text-[#0D1B3E]">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div data-reveal className="translate-y-6 text-center opacity-0 transition-all duration-700">
            <h2 className="text-3xl font-extrabold text-[#0D1B3E] sm:text-4xl">Simple, transparent pricing</h2>
            <p className="mt-3 text-lg text-slate-600">Start free. No hidden charges.</p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {pricing.map((plan) => (
              <article
                key={plan.name}
                data-reveal
                className={[
                  "translate-y-6 rounded-2xl border bg-white p-7 opacity-0 shadow-sm transition-all duration-700 hover:-translate-y-1 hover:shadow-md",
                  plan.featured ? "border-[#2563EB]" : "border-slate-200",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold tracking-[0.14em] text-[#1E40AF]">{plan.name}</p>
                    <p className="mt-3 text-4xl font-extrabold text-[#0D1B3E]">
                      {plan.price}
                      <span className="text-base font-semibold text-slate-500"> {plan.cycle}</span>
                    </p>
                  </div>
                  {plan.featured ? (
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-[#1E40AF]">Most Popular</span>
                  ) : null}
                </div>

                <ul className="mt-6 space-y-3 text-sm text-slate-700">
                  {plan.points.map((point) => (
                    <li key={point} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>

                {plan.name === "PRO" ? (
                  <Link
                    href="/contact"
                    className="mt-7 inline-flex h-11 w-full items-center justify-center rounded-xl border border-[#1E40AF]/30 text-sm font-semibold text-[#1E40AF] transition hover:border-[#1E40AF]"
                  >
                    {plan.cta}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={[
                      "mt-7 inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold transition",
                      plan.featured
                        ? "bg-[#1E40AF] text-white hover:bg-[#2563EB]"
                        : "border border-[#1E40AF]/30 text-[#1E40AF] hover:border-[#1E40AF]",
                    ].join(" ")}
                  >
                    {plan.cta}
                  </button>
                )}
                {plan.comingSoon ? (
                  <p className="mt-2 text-center text-xs font-medium text-slate-500">Coming soon</p>
                ) : null}
              </article>
            ))}
          </div>

          <p data-reveal className="mt-6 translate-y-6 text-center text-sm text-slate-600 opacity-0 transition-all duration-700">
            All plans include GST billing, loyalty program, and full reports
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div data-reveal className="translate-y-6 text-center opacity-0 transition-all duration-700">
            <h2 className="text-3xl font-extrabold text-[#0D1B3E] sm:text-4xl">Loved by salon owners</h2>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {testimonials.map((item) => (
              <article
                key={item.name}
                data-reveal
                className="translate-y-6 rounded-xl border border-slate-200 bg-white p-6 opacity-0 shadow-sm transition-all duration-700 hover:-translate-y-1 hover:shadow-md"
              >
                <Quote className="h-8 w-8 text-[#2563EB]" />
                <p className="mt-4 text-sm leading-relaxed text-slate-700">&quot;{item.quote}&quot;</p>
                <p className="mt-4 text-base text-amber-500">★★★★★</p>

                <div className="mt-5 flex items-center gap-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#0D1B3E] text-sm font-bold text-white">
                    {item.initials}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#0D1B3E]">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.role} · {item.salon}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-r from-[#0D1B3E] to-[#1E40AF] py-20">
        <div className="mx-auto w-full max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <div data-reveal className="translate-y-6 opacity-0 transition-all duration-700">
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">Ready to transform your salon?</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-blue-100">
              Join 150+ salons already using sczor. Start free today - no credit card required.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-[#0D1B3E] transition hover:bg-blue-50"
              >
                Start Free Today
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex h-12 items-center rounded-xl border border-white/60 px-6 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Contact Us
              </Link>
            </div>

            <p className="mt-4 text-sm font-medium text-blue-100">Setup takes less than 5 minutes</p>
          </div>
        </div>
      </section>
    </div>
  );
}